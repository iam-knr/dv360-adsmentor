// Regenerates prisma/sql/80-extended-rls.sql. Run: npx tsx prisma/sql/generate-extended-rls.ts
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderExtendedRlsSql } from './extended-rls';

const out = resolve(process.cwd(), 'prisma/sql/80-extended-rls.sql');
writeFileSync(out, renderExtendedRlsSql());
console.log(`wrote ${out}`);
