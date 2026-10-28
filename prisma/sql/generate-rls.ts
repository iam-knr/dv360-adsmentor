// Regenerates prisma/sql/40-rls-apply.sql from the Prisma schema. Run: npm run db:gen-rls
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseModels, readSchemaText, renderRlsApplySql } from '../../lib/db/schema-info';

const out = resolve(process.cwd(), 'prisma/sql/40-rls-apply.sql');
writeFileSync(out, renderRlsApplySql(parseModels(readSchemaText())));
console.log(`wrote ${out}`);
