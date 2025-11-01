import { PrismaClient } from '@prisma/client';

// Purges all reservations and their modifications, and frees occupied seats.
// Users are left untouched.
async function main() {
  const prisma = new PrismaClient();
  try {
    const [modsBefore, resBefore, busySeats] = await Promise.all([
      prisma.modificacion.count(),
      prisma.reservacion.count(),
      prisma.asiento.count({ where: { estado: 'Ocupado' } })
    ]);

    console.log(`About to delete: ${modsBefore} modificaciones, ${resBefore} reservaciones.`);
    console.log(`Seats currently occupied: ${busySeats}`);

    const results = await prisma.$transaction([
      // Modificaciones are set to cascade on delete of reservacion, but we clear both for clarity
      prisma.modificacion.deleteMany({}),
      prisma.reservacion.deleteMany({}),
      prisma.asiento.updateMany({ where: { estado: 'Ocupado' }, data: { estado: 'Libre' } }),
    ]);

    const [modsDel, resDel, seatsFreed] = results.map((r: any) => r.count ?? 0);
    const [modsAfter, resAfter, busyAfter] = await Promise.all([
      prisma.modificacion.count(),
      prisma.reservacion.count(),
      prisma.asiento.count({ where: { estado: 'Ocupado' } })
    ]);

    console.log(`Deleted modificaciones: ${modsDel}, reservaciones: ${resDel}, seats freed: ${seatsFreed}`);
    console.log(`Now remaining -> modificaciones: ${modsAfter}, reservaciones: ${resAfter}, occupied seats: ${busyAfter}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
