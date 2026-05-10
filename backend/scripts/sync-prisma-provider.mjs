/**
 * Copies prisma/schema.<DATABASE_PROVIDER>.prisma → prisma/schema.prisma
 * so one repo supports PostgreSQL and MySQL (Prisma requires a single provider per generate).
 *
 * Loads backend/.env if present (does not override existing process.env).
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

const provider = (process.env.DATABASE_PROVIDER || 'postgresql').toLowerCase();
if (provider !== 'postgresql' && provider !== 'mysql') {
  console.error(
    `[sync-prisma-provider] DATABASE_PROVIDER must be "postgresql" or "mysql", got: ${provider}`,
  );
  process.exit(1);
}

const src = path.join(backendRoot, 'prisma', `schema.${provider}.prisma`);
const dest = path.join(backendRoot, 'prisma', 'schema.prisma');

if (!fs.existsSync(src)) {
  console.error(`[sync-prisma-provider] Missing ${src}`);
  process.exit(1);
}

fs.copyFileSync(src, dest);
console.log(`[sync-prisma-provider] ${path.basename(src)} → schema.prisma`);
