-- Idempotent: add `refresh_tokens.audience` only when missing.
-- Covers legacy MySQL schemas created before the admin refresh split while keeping `migrate deploy` safe on DBs created from `20260519120000_mysql_baseline` (that migration already defines `audience`).

SET @preparedStatement = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'refresh_tokens'
        AND COLUMN_NAME = 'audience'
    ),
    'SELECT 1 AS audience_column_already_exists',
    'ALTER TABLE `refresh_tokens` ADD COLUMN `audience` ENUM(''user'', ''admin'') NOT NULL DEFAULT ''user'''
  )
);
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
