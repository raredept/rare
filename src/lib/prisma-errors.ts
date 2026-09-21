import { Prisma } from "@prisma/client";

/**
 * A unique-constraint violation on a given column.
 *
 * With the pg driver adapter, Prisma does not always fill `meta.target`; the
 * column name then only appears in the adapter details or the message, so all
 * three are checked.
 */
export function isUniqueViolationOn(error: unknown, column: string) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const meta = JSON.stringify(error.meta ?? {});
  return meta.includes(`"${column}"`) || error.message.includes(`\`${column}\``);
}
