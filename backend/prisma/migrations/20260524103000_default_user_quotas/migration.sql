-- 新注册用户缺省存储 1GiB、每月下载量配额 5GiB（与 env 常量一致；
-- 已通过迁移注册的用户沿用原 storage_quota_bytes，新增列对老用户回填默认值）。
ALTER TABLE `users` MODIFY COLUMN `storage_quota_bytes` BIGINT NOT NULL DEFAULT 1073741824;

ALTER TABLE `users`
ADD COLUMN `monthly_download_quota_bytes` BIGINT NOT NULL DEFAULT 5368709120
    COMMENT '单月出站下载配额（字节），计量逻辑待迭代';
