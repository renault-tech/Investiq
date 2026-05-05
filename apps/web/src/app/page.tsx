import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function RootPage() {
  const cookieStore = await cookies();
  const hasSession = cookieStore.has("refresh_token");
  redirect(hasSession ? "/investments" : "/login");
}
