import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
prisma.user.findUnique({where: {email: "admin@bookly.com"}, include: {memberships: true}}).then(u => {
  console.log(JSON.stringify(u, null, 2));
  process.exit(0);
});
