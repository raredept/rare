import { prisma } from "@/lib/prisma";
import { DEFAULT_INSTAGRAM_URL } from "@/lib/store-social";

export async function getStoreSettings() {
  return prisma.storeSettings.upsert({
    where: { id: "store" },
    update: {},
    create: {
      id: "store",
      storeName: "RARE",
      instagramUrl: DEFAULT_INSTAGRAM_URL,
      whatsappDefaultMessage: "Ola, tenho interesse em um produto da RARE.",
    },
  });
}
