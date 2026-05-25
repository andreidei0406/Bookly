import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { email: "andreidei0604@gmail.com" } });
  if (!user) return console.log("User not found");
  
  const business = await prisma.business.findFirst();
  if (!business) return console.log("Business not found");
  
  await prisma.businessMember.upsert({
    where: {
      userId_businessId: {
        userId: user.id,
        businessId: business.id
      }
    },
    update: {},
    create: {
      userId: user.id,
      businessId: business.id,
      role: 'OWNER'
    }
  });
  
  console.log("Linked user", user.email, "to business", business.name);
}

main().catch(console.error).finally(() => process.exit(0));
