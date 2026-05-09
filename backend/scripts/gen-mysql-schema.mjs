import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'prisma', 'schema.postgresql.prisma');
const dest = path.join(root, 'prisma', 'schema.mysql.prisma');
let s = fs.readFileSync(src, 'utf8');
s = s.replace(
  /^\/\/ PostgreSQL.*$/m,
  '// MySQL — keep in sync with schema.postgresql.prisma.',
);
s = s.replace('provider = "postgresql"', 'provider = "mysql"');
s = s.replace(/ @db\.Uuid/g, '');
s = s.replace(/@db\.Timestamptz\(6\)/g, '@db.DateTime(3)');
fs.writeFileSync(dest, s);
console.log('Wrote prisma/schema.mysql.prisma');
