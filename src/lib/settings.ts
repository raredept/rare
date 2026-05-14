import { prisma } from "@/lib/prisma";

export async function getStoreSettings() {
  return prisma.storeSettings.upsert({
    where: { id: "store" },
    update: {},
    create: {
      id: "store",
      storeName: "RARE",
      whatsappDefaultMessage: "Ola, tenho interesse em um produto da RARE.",
    },
  });
}
