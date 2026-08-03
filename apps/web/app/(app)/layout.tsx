import { redirect } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { SessionProvider } from "@/context/session-context";
import { getCurrentUser } from "@/lib/server/currentUser";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Defensive — middleware already gates this route group by cookie presence, but the cookie
  // could point at a since-revoked/expired session.
  if (!user) redirect("/sign-in");

  return (
    <SessionProvider initialUser={user}>
      <NavBar />
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </SessionProvider>
  );
}
