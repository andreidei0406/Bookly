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
    },
    create: {
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

  // ─── 2. Create Sample Customer User ───────────────────────────────
  const customerPassword = await bcrypt.hash('Customer1234!', SALT_ROUNDS);

  const customerUser = await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: {
      password: customerPassword,
    },
    create: {
      email: 'customer@example.com',
      password: customerPassword,
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '+1987654321',
      platformRole: 'USER',
      isActive: true,
      emailVerified: true,
    },
  });

  console.log(`✅ Sample customer created: ${customerUser.email} (${customerUser.id})`);

  // ─── 3. Create Sample Business ─────────────────────────────────────
  const business = await prisma.business.upsert({
    where: { slug: 'bookly-demo-salon' },
    update: {},
    create: {
      name: 'Bookly Demo Salon',
      slug: 'bookly-demo-salon',
      description: 'A demo salon to showcase Bookly features.',
      email: 'info@booklydemo.com',
      phone: '+1555000100',
      address: '123 Main Street',
      city: 'New York',
      state: 'NY',
      country: 'US',
      zipCode: '10001',
      timezone: 'America/New_York',
      isActive: true,
    },
  });

  console.log(`✅ Sample business created: ${business.name} (${business.id})`);

  // ─── 4. Create Admin as OWNER of the Business ─────────────────────
  const ownerMembership = await prisma.businessMember.upsert({
    where: {
      userId_businessId: {
        userId: adminUser.id,
        businessId: business.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      businessId: business.id,
      role: 'OWNER',
      isActive: true,
    },
  });

  console.log(`✅ Admin set as OWNER of "${business.name}" (membership: ${ownerMembership.id})`);

  // ─── 5. Create Sample Services ─────────────────────────────────────
  const servicesData = [
    {
      name: 'Haircut',
      description: 'Professional haircut with styling.',
      duration: 30,
      price: 25.0,
      currency: 'USD',
      color: '#4CAF50',
    },
    {
      name: 'Hair Coloring',
      description: 'Full hair coloring service with premium products.',
      duration: 90,
      price: 80.0,
      currency: 'USD',
      color: '#FF9800',
    },
    {
      name: 'Beard Trim',
      description: 'Quick beard trim and shaping.',
      duration: 15,
      price: 15.0,
      currency: 'USD',
      color: '#2196F3',
    },
    {
      name: 'Full Styling',
      description: 'Complete hair styling session including wash and blow dry.',
      duration: 60,
      price: 50.0,
      currency: 'USD',
      color: '#9C27B0',
    },
  ];

  const services = [];
  for (const serviceData of servicesData) {
    const service = await prisma.service.upsert({
      where: {
        id: `seed-service-${serviceData.name.toLowerCase().replace(/\s+/g, '-')}`,
      },
      update: {},
      create: {
        businessId: business.id,
        ...serviceData,
        isActive: true,
      },
    });
    services.push(service);
    console.log(`✅ Service created: ${service.name} (${service.duration}min, $${service.price})`);
  }

  // ─── 6. Create Working Hours ───────────────────────────────────────
  const workingHoursData = [
    { dayOfWeek: 'MONDAY', openTime: '09:00', closeTime: '17:00', isClosed: false },
    { dayOfWeek: 'TUESDAY', openTime: '09:00', closeTime: '17:00', isClosed: false },
    { dayOfWeek: 'WEDNESDAY', openTime: '09:00', closeTime: '17:00', isClosed: false },
    { dayOfWeek: 'THURSDAY', openTime: '09:00', closeTime: '17:00', isClosed: false },
    { dayOfWeek: 'FRIDAY', openTime: '09:00', closeTime: '17:00', isClosed: false },
    { dayOfWeek: 'SATURDAY', openTime: '10:00', closeTime: '14:00', isClosed: false },
    { dayOfWeek: 'SUNDAY', openTime: '00:00', closeTime: '00:00', isClosed: true },
  ];

  for (const whData of workingHoursData) {
    const workingHour = await prisma.workingHours.upsert({
      where: {
        businessId_dayOfWeek: {
          businessId: business.id,
          dayOfWeek: whData.dayOfWeek,
        },
      },
      update: {},
      create: {
        businessId: business.id,
        ...whData,
      },
    });

    const status = workingHour.isClosed
      ? 'CLOSED'
      : `${workingHour.openTime} - ${workingHour.closeTime}`;
    console.log(`✅ Working hours: ${workingHour.dayOfWeek} → ${status}`);
  }

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
