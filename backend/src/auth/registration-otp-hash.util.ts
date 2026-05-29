import { createHash } from 'crypto';



export function hashRegistrationOtp(normalizedEmail: string, otp: string): string {

  return createHash('sha256')

    .update(`${normalizedEmail}:${otp}`, 'utf8')

    .digest('hex');

}


