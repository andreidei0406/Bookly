/**
 * @module prisma
 * @description Prisma client singleton for the Bookly API.
 * Uses globalThis to cache the instance across hot-reloads in development.
 * Logs queries in development mode for easier debugging.
 */

import { PrismaClient } from '../prisma/client/client.ts';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import config from '../config/index.js';

const connectionString = config.db.url;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const isDevelopment = config.env === 'development';

/**
 * Creates a new PrismaClient instance with environment-appropriate settings.
 * @returns {PrismaClient}
 */
const createPrismaClient = () => new PrismaClient({
    adapter,
    log: isDevelopment
      ? [
          { emit: 'stdout', level: 'query' },
          { emit: 'stdout', level: 'info' },
          { emit: 'stdout', level: 'warn' },
          { emit: 'stdout', level: 'error' },
        ]
      : [
          { emit: 'stdout', level: 'warn' },
          { emit: 'stdout', level: 'error' },
        ],
  });

/** @type {PrismaClient} */
const prisma = globalThis.__prisma ?? createPrismaClient();

if (isDevelopment) {
  globalThis.__prisma = prisma;
}

export default prisma;
