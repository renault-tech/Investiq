import { cookies } from "next/headers";
import { InvestmentsClient } from "@/components/investments/InvestmentsClient";
import type { Portfolio } from "@/lib/portfolio-api";

export default async function InvestmentsPage() {
  const API_BASE =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  let initialPortfolios: Portfolio[] = [];
  try {
    const res = await fetch(`${API_BASE}/portfolios/`, {
      headers: { Cookie: cookieHeader },
      cache: "no-store",
    });
    if (res.ok) {
      initialPortfolios = await res.json();
    }
  } catch {
    // silently fail — client will refetch via TanStack Query
  }

  return <InvestmentsClient initialPortfolios={initialPortfolios} />;
}
