import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SubscriptionStatus, SubscriptionType } from '@prisma/client';

export class UpdateSubscriptionDto {
  @IsOptional()
  @IsEnum(SubscriptionType)
  type?: SubscriptionType;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(4096)
  sourceUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  displayName?: string | null;

  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(86400 * 7)
  checkIntervalSec?: number;

  @IsOptional()
  @IsObject()
  downloadOptions?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  filterRules?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  notifyEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyDesktop?: boolean;
}
