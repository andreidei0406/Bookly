import { defineConfig, env } from 'prisma/config';
import fs from 'fs';

if (fs.existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  schema: 'src/prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
