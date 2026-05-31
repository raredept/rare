import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type CartRedirectPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CartRedirectPage({ searchParams }: CartRedirectPageProps) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => params.append(key, entry));
    } else if (typeof value === "string") {
      params.set(key, value);
    }
  }

  const query = params.toString();
  redirect(`/finalizar-compra${query ? `?${query}` : ""}`);
}
