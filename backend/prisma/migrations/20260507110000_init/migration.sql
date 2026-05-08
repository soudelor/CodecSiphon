-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('pending', 'queued', 'parsing', 'downloading', 'processing', 'completed', 'paused', 'cancelled', 'failed');

-- CreateEnum
CREATE TYPE "TaskSourceType" AS ENUM ('single_url', 'multi_url', 'playlist', 'subscription');

-- CreateEnum
CREATE TYPE "SubscriptionType" AS ENUM ('channel', 'playlist', 'rss');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'paused');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(100),
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "storage_quota_bytes" BIGINT NOT NULL DEFAULT 107374182400,
    "storage_used_bytes" BIGINT NOT NULL DEFAULT 0,
    "email_verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "user_id" UUID NOT NULL,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "download_defaults" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "global_settings" (
    "key" VARCHAR(64) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "global_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "folders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "path" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "SubscriptionType" NOT NULL,
    "source_url" TEXT NOT NULL,
    "display_name" VARCHAR(255),
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "check_interval_sec" INTEGER NOT NULL DEFAULT 21600,
    "download_options" JSONB NOT NULL DEFAULT '{}',
    "filter_rules" JSONB NOT NULL DEFAULT '{}',
    "notify_email" BOOLEAN NOT NULL DEFAULT false,
    "notify_desktop" BOOLEAN NOT NULL DEFAULT false,
    "last_checked_at" TIMESTAMPTZ(6),
    "last_item_published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_runs" (
    "id" BIGSERIAL NOT NULL,
    "subscription_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),
    "new_tasks_created" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,

    CONSTRAINT "subscription_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "download_tasks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "subscription_id" UUID,
    "source_type" "TaskSourceType" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'pending',
    "source_url" TEXT,
    "source_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "title" TEXT,
    "platform" VARCHAR(64),
    "options" JSONB NOT NULL DEFAULT '{}',
    "progress_percent" SMALLINT NOT NULL DEFAULT 0,
    "bytes_downloaded" BIGINT NOT NULL DEFAULT 0,
    "bytes_total" BIGINT,
    "speed_bytes_per_sec" INTEGER,
    "error_code" VARCHAR(64),
    "error_message" TEXT,
    "scheduled_at" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "download_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_items" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "item_index" INTEGER NOT NULL,
    "canonical_id" VARCHAR(128),
    "item_url" TEXT NOT NULL,
    "title" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'pending',
    "progress_percent" SMALLINT NOT NULL DEFAULT 0,
    "media_file_id" UUID,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "task_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_logs" (
    "id" BIGSERIAL NOT NULL,
    "task_id" UUID NOT NULL,
    "level" VARCHAR(16) NOT NULL,
    "message" TEXT NOT NULL,
    "meta" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_files" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "task_id" UUID,
    "folder_id" UUID,
    "file_name" VARCHAR(512) NOT NULL,
    "relative_path" TEXT NOT NULL,
    "mime_type" VARCHAR(128),
    "size_bytes" BIGINT NOT NULL,
    "duration_sec" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "checksum_sha256" VARCHAR(64),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "folders_user_id_idx" ON "folders"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "folders_user_id_path_key" ON "folders"("user_id", "path");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_status_idx" ON "subscriptions"("user_id", "status");

-- CreateIndex
CREATE INDEX "subscription_runs_subscription_id_id_idx" ON "subscription_runs"("subscription_id", "id" DESC);

-- CreateIndex
CREATE INDEX "download_tasks_user_id_status_created_at_idx" ON "download_tasks"("user_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "download_tasks_user_id_created_at_idx" ON "download_tasks"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "task_items_task_id_idx" ON "task_items"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_items_task_id_item_index_key" ON "task_items"("task_id", "item_index");

-- CreateIndex
CREATE INDEX "task_logs_task_id_id_idx" ON "task_logs"("task_id", "id" DESC);

-- CreateIndex
CREATE INDEX "media_files_user_id_created_at_idx" ON "media_files"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "media_files_user_id_file_name_idx" ON "media_files"("user_id", "file_name");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_runs" ADD CONSTRAINT "subscription_runs_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "download_tasks" ADD CONSTRAINT "download_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "download_tasks" ADD CONSTRAINT "download_tasks_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_items" ADD CONSTRAINT "task_items_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "download_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_items" ADD CONSTRAINT "task_items_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_logs" ADD CONSTRAINT "task_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "download_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "download_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DATABASE_DESIGN.md §3.7: partial unique when canonical_id is set
CREATE UNIQUE INDEX "task_items_task_id_canonical_id_key" ON "task_items" ("task_id", "canonical_id") WHERE "canonical_id" IS NOT NULL;

-- DATABASE_DESIGN.md §3.6: optional GIN for URL dedup queries
CREATE INDEX "download_tasks_source_urls_gin" ON "download_tasks" USING GIN ("source_urls");
