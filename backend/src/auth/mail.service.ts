import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as dns from 'node:dns';
import type { ConnectionOptions as TlsConnectionOptions } from 'node:tls';
import nodemailer from 'nodemailer';

/** 形如 1.2.3.4 的 IPv4，用于判断是否需在 TLS 里显式 SNI */
function looksLikeIpv4(host: string): boolean {
  if (!host || host.includes(':')) return false;
  const parts = host.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    const n = Number(p);
    return Number.isInteger(n) && n >= 0 && n <= 255 && String(n) === p;
  });
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  private isConfigured(): boolean {
    return Boolean(this.config.get<string>('SMTP_HOST')?.trim());
  }

  /** 注册 OTP 等发信链路是否就绪（未配置 SMTP 时须拒绝索取验证码）。 */
  smtpConfigured(): boolean {
    return this.isConfigured();
  }

  private smtpDiagnosticsHint(message: string): string {
    const m = message.toLowerCase();
    if (m.includes('querya') && m.includes('etimeout')) {
      return [
        '（DNS 解析 SMTP 域名超时）请检查本机/服务器 DNS（可尝试改用 223.5.5.5、119.29.29.29 或运营商 DNS）、',
        '防火墙/代理是否放行 UDP/TCP 53，或在可解析的机器上 ping/nslookup SMTP_HOST；',
        '请在 backend/.env 设 SMTP_DNS_IPV4_ONLY=true 并重启：将先用 IPv4 解析再直连服务器，可避免 Node/nodemailer 内部 queryA 超时。',
      ].join('');
    }
    if (m.includes('econnrefused')) {
      return '（TCP 被拒）常与端口错误、或未放行 SMTP 出站（如封锁 465）有关；可改用 SMTP_PORT=587 且 SMTP_SECURE=false。';
    }
    if (
      m.includes('unexpected socket close') ||
      m.includes('socket close') ||
      m.includes('econnreset')
    ) {
      return [
        '（连接被对方关闭）常与 TLS 模式不匹配有关：465 为 SSL（implicit）；587/25 为明文起手 + STARTTLS；',
        '请确认 SMTP_PORT / SMTP_SECURE 与邮箱文档一致（163：465+SSL，或 587 + SMTP_SECURE=false），',
        '或改用另一端口试验；可调 SMTP_DEBUG=1 打出 nodemailer 会话日志。',
      ].join('');
    }
    return '';
  }

  /** @returns true 已成功交给 SMTP，false 为未配置或发送失败（仅日志） */
  async sendPasswordResetEmail(
    toEmail: string,
    resetLink: string,
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.warn(
        `SMTP_HOST not set; skip password reset mail to=${toEmail} link=${resetLink}`,
      );
      return false;
    }
    const appName = this.config.get<string>('MAIL_APP_NAME')?.trim() ?? 'CodecSiphon';
    const text = [
      `${appName} — 重置密码`,
      '',
      `请点击以下链接重置密码（若无法点击可复制到浏览器）：`,
      resetLink,
      '',
      `链接短时有效且仅可使用一次；若不是你本人操作，请忽略此邮件。`,
    ].join('\n');

    const html = `<p>${appName} — 重置密码</p><p><a href="${resetLink}">${resetLink}</a></p><p>链接短时有效且仅可使用一次；若不是你本人操作，请忽略。</p>`;

    return this.smtpSendMail({
      kind: 'password-reset',
      to: toEmail,
      subject: `${appName} 重置密码`,
      text,
      html,
    });
  }

  /** 注册邮箱 6 位 OTP */
  async sendRegistrationOtpEmail(
    toEmail: string,
    otpPlain: string,
    validMinutes: number,
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.warn(
        `SMTP_HOST not set; skip registration OTP mail to=${toEmail}`,
      );
      return false;
    }
    const appName = this.config.get<string>('MAIL_APP_NAME')?.trim() ?? 'CodecSiphon';
    const text = [
      `${appName} — 注册验证码`,
      '',
      `你的验证码是：${otpPlain}`,
      '',
      `约 ${validMinutes} 分钟内有效，仅可使用一次。`,
      `若不是你本人操作，请忽略此邮件。`,
    ].join('\n');

    const html = `<p>${appName} — 注册验证码</p><p>验证码：<strong>${otpPlain}</strong></p><p>约 ${validMinutes} 分钟内有效，仅可使用一次。若不是你本人操作，请忽略。</p>`;

    return this.smtpSendMail({
      kind: 'registration-otp',
      to: toEmail,
      subject: `${appName} 注册验证码`,
      text,
      html,
    });
  }

  private async smtpSendMail(params: {
    kind: 'password-reset' | 'registration-otp';
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<boolean> {
    const host = this.config.get<string>('SMTP_HOST')!.trim();
    const hostnameLogical = host;

    const portParsed = Number.parseInt(
      String(this.config.get<string>('SMTP_PORT') ?? '587'),
      10,
    );
    const port =
      Number.isFinite(portParsed) && portParsed > 0 ? portParsed : 587;

    const secureRaw = (this.config.get<string>('SMTP_SECURE') ?? '')
      .trim()
      .toLowerCase();
    const secureExplicit =
      secureRaw === 'true' ||
      secureRaw === '1' ||
      secureRaw === 'yes' ||
      secureRaw === 'on';
    const insecureExplicit =
      secureRaw === 'false' || secureRaw === '0' || secureRaw === 'no';

    const startTlsPorts = new Set([25, 587, 2525]);
    let secure = false;
    if (startTlsPorts.has(port)) {
      if (secureExplicit) {
        this.logger.warn(
          `SMTP_PORT=${port} 使用 STARTTLS，已忽略 SMTP_SECURE=true；若需 SSL 直连请改用 465`,
        );
      }
      secure = false;
    } else if (port === 465 || port === 994) {
      secure = !insecureExplicit;
    } else {
      secure = secureExplicit && !insecureExplicit;
    }

    const requireTls = !secure && startTlsPorts.has(port);

    const user = this.config.get<string>('SMTP_USER')?.trim() ?? '';
    const pass = this.config.get<string>('SMTP_PASS') ?? '';
    const from =
      this.config.get<string>('MAIL_FROM')?.trim() ||
      `"CodecSiphon" <${user || 'noreply@localhost'}>`;

    const ipv4OnlyRaw =
      this.config.get<string>('SMTP_DNS_IPV4_ONLY')?.trim() ?? '';
    const dnsIpv4Only =
      ipv4OnlyRaw === '1' ||
      ipv4OnlyRaw.toLowerCase() === 'true' ||
      ipv4OnlyRaw.toLowerCase() === 'yes';

    let connectHost = hostnameLogical;

    // STARTTLS（587）应连域名；仅 465 等 implicit SSL 才预解析 IPv4（绕开 nodemailer queryA 超时）
    const implicitSslPort = port === 465 || port === 994;
    if (dnsIpv4Only && implicitSslPort && !looksLikeIpv4(hostnameLogical)) {
      try {
        const r = await dns.promises.lookup(hostnameLogical, {
          family: 4,
          verbatim: false,
        });
        connectHost = r.address;
      } catch (dnsErr) {
        this.logger.error(
          `SMTP pre-resolve IPv4 failed for=${hostnameLogical}: ${String(
            dnsErr,
          )}`,
        );
        return false;
      }
    }

    const tlsExplicit =
      this.config.get<string>('SMTP_TLS_SERVERNAME')?.trim() ?? '';
    const tlsServerName =
      tlsExplicit ||
      (looksLikeIpv4(connectHost) ? hostnameLogical : connectHost);

    // EHLO 身份须为客户端主机名，勿与 SMTP 服务器域名相同（否则 163 等可能直接断连）
    const ehloHostname =
      this.config.get<string>('SMTP_EHLO_HOSTNAME')?.trim() || 'localhost';

    const tlsOptions: TlsConnectionOptions = {
      minVersion: 'TLSv1.2',
    };
    if (tlsServerName) {
      tlsOptions.servername = tlsServerName;
    }

    const connectionTimeoutMs = Math.min(
      120_000,
      Math.max(
        10_000,
        Number(
          this.config.get<string>('SMTP_CONNECTION_TIMEOUT_MS') ?? '45000',
        ) || 45_000,
      ),
    );

    const smtpDebug =
      (this.config.get<string>('SMTP_DEBUG') ?? '').trim() === '1';

    const transporter = nodemailer.createTransport({
      host: connectHost,
      port,
      secure,
      requireTLS: requireTls,
      name: ehloHostname,
      connectionTimeout: connectionTimeoutMs,
      greetingTimeout: connectionTimeoutMs,
      socketTimeout: connectionTimeoutMs,
      tls: tlsOptions,
      ...(user ? { auth: { user, pass } } : {}),
      ...(smtpDebug ? { logger: true, debug: true } : {}),
    });

    this.logger.log(
      `SMTP send start kind=${params.kind} to=${params.to} subject="${params.subject}" from=${from} via=${connectHost}:${port} secure=${secure} requireTLS=${requireTls}`,
    );

    try {
      const info = await transporter.sendMail({
        from,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });
      this.logger.log(
        `SMTP send ok kind=${params.kind} to=${params.to} messageId=${String(info.messageId ?? 'n/a')} accepted=${JSON.stringify(info.accepted ?? [])} response=${String(info.response ?? 'n/a')}`,
      );
      return true;
    } catch (e) {
      const msg = String(e);
      const hint = this.smtpDiagnosticsHint(msg);
      this.logger.error(
        `SMTP send failed kind=${params.kind} to=${params.to}: ${msg}${hint ? ` ${hint}` : ''}`,
      );
      return false;
    }
  }
}