-- Baseline（20260519120000）曾为 `storage_quota_bytes` 使用默认值 107374182400（100 GiB）。
-- 产品现行缺省为 1 GiB（1073741824）；已将表级 DEFAULT 调整为 1 GiB，
-- 但历史行在未显式 PATCH 时会一直保留旧的 100 GiB。
-- 此处仅更新「仍等于 baseline 默认值」的行，不把管理员另行上调的配额改小。
UPDATE `users`
SET `storage_quota_bytes` = 1073741824
WHERE `storage_quota_bytes` = 107374182400;
