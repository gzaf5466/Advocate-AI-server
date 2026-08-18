import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ url: process.env.DATABASE_URL });

const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log(`PostgreSQL Connected via Prisma`);
  } catch (error) {
    console.error(`Error connecting to PostgreSQL: ${error.message}`);
    process.exit(1);
  }
};

export { prisma };
export default connectDB;
