// Starts an embedded Postgres 17 on port 54329 and creates dv360_dev and dv360_test.
// Data lives in .pgdata (git-ignored). Stop with Ctrl+C.
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { userInfo } from 'node:os';

const PORT = Number(process.env.DEV_DB_PORT ?? 54329);
const dataDir = resolve(process.cwd(), '.pgdata');
const databases = ['dv360_dev', 'dv360_test'];

async function main() {
  const fresh = !existsSync(resolve(dataDir, 'PG_VERSION'));
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port: PORT,
    persistent: true,
    // initdb refuses to run as root (cloud containers); let the library use the postgres OS user
    createPostgresUser: userInfo().uid === 0,
  });
  if (fresh) await pg.initialise();
  await pg.start();
  for (const name of databases) {
    try {
      await pg.createDatabase(name);
      console.log(`created database ${name}`);
    } catch {
      // already exists
    }
  }
  console.log(`Postgres ready on postgresql://postgres:postgres@127.0.0.1:${PORT}`);
  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
