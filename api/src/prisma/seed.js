import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

const SALT_ROUNDS = 12;

/**
 * Seed the database with initial data for development and demo purposes.
 */
async function main() {
  console.log('🌱 Starting database seed...\n');

  // ─── 1. Create Super Admin User ────────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin1234!', SALT_ROUNDS);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@bookly.com' },
    update: {
      password: adminPassword,
      username: 'admin',
    },
    create: {
      username: 'admin',
      email: 'admin@bookly.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'Bookly',
      phone: '+1234567890',
      platformRole: 'SUPER_ADMIN',
      isActive: true,
      emailVerified: true,
    },
  });

  console.log(`✅ Super admin user created: ${adminUser.email} (${adminUser.id})`);

  // ─── 2. Create Sample Host User ───────────────────────────────
  const hostPassword = await bcrypt.hash('Host1234!', SALT_ROUNDS);

  const hostUser = await prisma.user.upsert({
    where: { email: 'host@example.com' },
    update: {
      password: hostPassword,
      username: 'jane-doe',
    },
    create: {
      username: 'jane-doe',
      email: 'host@example.com',
      password: hostPassword,
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '+1987654321',
      platformRole: 'USER',
      isActive: true,
      emailVerified: true,
    },
  });

  console.log(`✅ Sample host user created: ${hostUser.email} (${hostUser.id})`);

  console.log('\n🎉 Database seed completed successfully!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('❌ Seed failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
