-- 存储限额产品上线日（北京时间）为 2026-06-01；
-- 在此日期零点之前注册的普通用户：`storage_quota_bytes` 一律改为 1 GiB（与新用户缺省一致）。
-- 不修改管理员账号（staff）。
UPDATE `users`
SET `storage_quota_bytes` = 1073741824
WHERE `role` = 'user'
  AND `created_at` < '2026-06-01 00:00:00.000';
