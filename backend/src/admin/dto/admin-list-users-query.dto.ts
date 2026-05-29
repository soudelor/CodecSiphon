import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export class AdminListUsersQueryDto {
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

  /** 邮箱子串筛选（服务端会转小写） */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  emailContains?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  createdAfter?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  createdBefore?: string;

  /** 等价于邮箱等于（可选，严格匹配便于运营） */
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  emailExact?: string;

  /** `"true"` / `"false"`；按启用状态筛选 */
  @IsOptional()
  @IsString()
  @IsIn(['true', 'false'])
  isActive?: string;
}
