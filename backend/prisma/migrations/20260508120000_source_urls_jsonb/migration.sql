-- PostgreSQL only: TEXT[] -> JSONB for cross-DB compatibility (MySQL uses Json + prisma db push / separate workflow).
DROP INDEX IF EXISTS "download_tasks_source_urls_gin";

ALTER TABLE "download_tasks" ALTER COLUMN "source_urls" DROP DEFAULT;

ALTER TABLE "download_tasks"
  ALTER COLUMN "source_urls" TYPE JSONB USING to_jsonb("source_urls");

ALTER TABLE "download_tasks" ALTER COLUMN "source_urls" SET DEFAULT '[]'::jsonb;
