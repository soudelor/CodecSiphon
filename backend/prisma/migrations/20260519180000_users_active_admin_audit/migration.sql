-- U-05 + NF-01: 账号启用状态 + 管理审计表

ALTER TABLE `users`
ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN `disabled_at` DATETIME(3) NULL;

CREATE TABLE `admin_audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `actor_id` VARCHAR(36) NOT NULL,
    `action` VARCHAR(64) NOT NULL,
    `target_type` VARCHAR(32) NOT NULL,
    `target_id` VARCHAR(36) NULL,
    `ip` VARCHAR(45) NULL,
    `detail_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `admin_audit_logs_created_at_idx`(`created_at`),
    INDEX `admin_audit_logs_actor_id_created_at_idx`(`actor_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
