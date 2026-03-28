import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env' });
loadEnv({ path: '.env.local', override: true });
loadEnv({ path: '.dev.vars', override: true });

async function main() {
  const { ensureXTrendSchema } = await import('../src/lib/x-trends/ensure-schema');
  await ensureXTrendSchema();
  console.log('x trends schema ensured');
}

main().catch((error) => {
  console.error('db-ensure-x-trends failed:', error);
  process.exit(1);
});
