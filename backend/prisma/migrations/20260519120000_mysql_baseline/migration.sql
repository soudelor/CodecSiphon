-- CodecSiphon MySQL baseline (squashed). Replaces former PostgreSQL-only migrations.
-- Prisma: `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `display_name` VARCHAR(100) NULL,
    `role` ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    `storage_quota_bytes` BIGINT NOT NULL DEFAULT 107374182400,
    `storage_used_bytes` BIGINT NOT NULL DEFAULT 0,
    `email_verified_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `token_hash` VARCHAR(64) NOT NULL,
    `audience` ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_token_hash_key`(`token_hash`),
    INDEX `refresh_tokens_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_settings` (
    `user_id` VARCHAR(191) NOT NULL,
    `preferences` JSON NOT NULL,
    `download_defaults` JSON NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `global_settings` (
    `key` VARCHAR(64) NOT NULL,
    `value` JSON NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `folders` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `parent_id` VARCHAR(191) NULL,
    `name` VARCHAR(255) NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `folders_user_id_idx`(`user_id`),
    UNIQUE INDEX `folders_user_id_path_key`(`user_id`, `path`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `type` ENUM('channel', 'playlist', 'rss') NOT NULL,
    `source_url` VARCHAR(191) NOT NULL,
    `display_name` VARCHAR(255) NULL,
    `status` ENUM('active', 'paused') NOT NULL DEFAULT 'active',
    `check_interval_sec` INTEGER NOT NULL DEFAULT 21600,
    `download_options` JSON NOT NULL,
    `filter_rules` JSON NOT NULL,
    `notify_email` BOOLEAN NOT NULL DEFAULT false,
    `notify_desktop` BOOLEAN NOT NULL DEFAULT false,
    `last_checked_at` DATETIME(3) NULL,
    `last_item_published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `subscriptions_user_id_status_idx`(`user_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_runs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `subscription_id` VARCHAR(191) NOT NULL,
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finished_at` DATETIME(3) NULL,
    `new_tasks_created` INTEGER NOT NULL DEFAULT 0,
    `error_message` VARCHAR(191) NULL,

    INDEX `subscription_runs_subscription_id_id_idx`(`subscription_id`, `id` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `download_tasks` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `subscription_id` VARCHAR(191) NULL,
    `source_type` ENUM('single_url', 'multi_url', 'playlist', 'subscription') NOT NULL,
    `status` ENUM('pending', 'queued', 'parsing', 'downloading', 'processing', 'completed', 'paused', 'cancelled', 'failed') NOT NULL DEFAULT 'pending',
    `source_url` VARCHAR(191) NULL,
    `source_urls` JSON NOT NULL,
    `title` VARCHAR(191) NULL,
    `platform` VARCHAR(64) NULL,
    `options` JSON NOT NULL,
    `progress_percent` SMALLINT NOT NULL DEFAULT 0,
    `bytes_downloaded` BIGINT NOT NULL DEFAULT 0,
    `bytes_total` BIGINT NULL,
    `speed_bytes_per_sec` INTEGER NULL,
    `error_code` VARCHAR(64) NULL,
    `error_message` VARCHAR(191) NULL,
    `scheduled_at` DATETIME(3) NULL,
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `download_tasks_user_id_status_created_at_idx`(`user_id`, `status`, `created_at` DESC),
    INDEX `download_tasks_user_id_created_at_idx`(`user_id`, `created_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_items` (
    `id` VARCHAR(191) NOT NULL,
    `task_id` VARCHAR(191) NOT NULL,
    `item_index` INTEGER NOT NULL,
    `canonical_id` VARCHAR(128) NULL,
    `item_url` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `status` ENUM('pending', 'queued', 'parsing', 'downloading', 'processing', 'completed', 'paused', 'cancelled', 'failed') NOT NULL DEFAULT 'pending',
    `progress_percent` SMALLINT NOT NULL DEFAULT 0,
    `media_file_id` VARCHAR(191) NULL,
    `error_message` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `task_items_task_id_idx`(`task_id`),
    UNIQUE INDEX `task_items_task_id_item_index_key`(`task_id`, `item_index`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `task_id` VARCHAR(191) NOT NULL,
    `level` VARCHAR(16) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `meta` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `task_logs_task_id_id_idx`(`task_id`, `id` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `media_files` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `task_id` VARCHAR(191) NULL,
    `folder_id` VARCHAR(191) NULL,
    `file_name` VARCHAR(512) NOT NULL,
    `relative_path` VARCHAR(191) NOT NULL,
    `mime_type` VARCHAR(128) NULL,
    `size_bytes` BIGINT NOT NULL,
    `duration_sec` INTEGER NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `checksum_sha256` VARCHAR(64) NULL,
    `metadata` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `media_files_user_id_created_at_idx`(`user_id`, `created_at` DESC),
    INDEX `media_files_user_id_file_name_idx`(`user_id`, `file_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_settings` ADD CONSTRAINT `user_settings_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `folders` ADD CONSTRAINT `folders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `folders` ADD CONSTRAINT `folders_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `folders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_runs` ADD CONSTRAINT `subscription_runs_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `download_tasks` ADD CONSTRAINT `download_tasks_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `download_tasks` ADD CONSTRAINT `download_tasks_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_items` ADD CONSTRAINT `task_items_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `download_tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_items` ADD CONSTRAINT `task_items_media_file_id_fkey` FOREIGN KEY (`media_file_id`) REFERENCES `media_files`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_logs` ADD CONSTRAINT `task_logs_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `download_tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `media_files` ADD CONSTRAINT `media_files_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `media_files` ADD CONSTRAINT `media_files_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `download_tasks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `media_files` ADD CONSTRAINT `media_files_folder_id_fkey` FOREIGN KEY (`folder_id`) REFERENCES `folders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
