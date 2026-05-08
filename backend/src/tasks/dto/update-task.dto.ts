import { TaskStatus } from '@prisma/client';
import { IsIn } from 'class-validator';

/** 用户可通过 PATCH 设置的状态：暂停、取消、继续/重试（queued） */
export const USER_PATCHABLE_STATUSES: TaskStatus[] = [
  TaskStatus.paused,
  TaskStatus.cancelled,
  TaskStatus.queued,
];

export class UpdateTaskDto {
  @IsIn(USER_PATCHABLE_STATUSES)
  status!: TaskStatus;
}
