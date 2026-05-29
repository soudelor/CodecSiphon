/**
 * MySQL-only: `prisma/schema.prisma` is the single source of truth (no PG/MySQL copy step).
 * Loads backend/.env so prisma CLI and npm scripts see DATABASE_URL.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, '..');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = v;
  }
}

loadEnvFile(path.join(backendRoot, '.env'));

const schemaPath = path.join(backendRoot, 'prisma', 'schema.prisma');
if (!fs.existsSync(schemaPath)) {
  console.error(`[sync-prisma-provider] Missing ${schemaPath}`);
  process.exit(1);
}

const url = process.env.DATABASE_URL || '';
if (url && !/^mysql:/i.test(url)) {
  console.warn(
    '[sync-prisma-provider] DATABASE_URL should start with mysql:// (MySQL-only repo).',
  );
}
console.log('[sync-prisma-provider] Using prisma/schema.prisma (MySQL)');
