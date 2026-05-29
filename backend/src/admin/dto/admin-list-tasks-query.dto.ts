import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TaskSourceType, TaskStatus } from '@prisma/client';

export class AdminListTasksQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsUUID()
  userId?: string;

  /** 归属用户邮箱子串（小写比对） */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  userEmail?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskSourceType)
  sourceType?: TaskSourceType;

  /** title 关键字 */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  createdAfter?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  createdBefore?: string;
}
