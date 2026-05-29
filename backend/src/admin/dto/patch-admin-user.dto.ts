import { UserRole } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, Matches } from 'class-validator';

/** 只允许白名单字段。参见 ADMIN_MODULE §9.2。 */
export class PatchAdminUserDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  /** 字节数（非负整数，整数字符串） */
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, {
    message: 'storageQuotaBytes must be a non-negative integer string',
  })
  storageQuotaBytes?: string;

  /** 单月出站下载配额上限（字节，非负整数串）；计量与超限拦截待后续实现 */
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, {
    message:
      'monthlyDownloadQuotaBytes must be a non-negative integer string',
  })
  monthlyDownloadQuotaBytes?: string;

  /** U-05：设为 `false` 时禁止登录与刷新；同时写入 `disabledAt`。 */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
