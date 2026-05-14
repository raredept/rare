import "dotenv/config";

async function main() {
  const [{ releaseExpiredReservations }, { prisma }] = await Promise.all([
    import("../src/lib/checkout"),
    import("../src/lib/prisma"),
  ]);

  const count = await releaseExpiredReservations();
  console.log(`Expired reservations released: ${count}`);
  await prisma.$disconnect();
}

main()
  .then(() => {
    return undefined;
  })
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : "Expired reservation release failed.");
    const { prisma } = await import("../src/lib/prisma").catch(() => ({ prisma: null }));
    if (prisma) {
      await prisma.$disconnect();
    }
    process.exit(1);
  });
