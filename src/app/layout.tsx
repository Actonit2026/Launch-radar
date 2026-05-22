import type { Metadata } from "next";
import Link from "next/link";
import { signOutAction } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "LaunchRadar",
  description: "Track competitor pricing, messaging, and product changes.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <header className="border-b border-ink/10 bg-paper/85 backdrop-blur">
          <nav className="mx-auto flex h-[72px] w-full max-w-6xl items-center justify-between px-6">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              LaunchRadar
            </Link>
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <Link
                    href="/dashboard"
                    className="rounded-md px-4 py-2 text-sm font-semibold text-ink/75 transition hover:text-ink"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/dashboard/your-product"
                    className="rounded-md px-4 py-2 text-sm font-semibold text-ink/75 transition hover:text-ink"
                  >
                    Your Product
                  </Link>
                  <Link
                    href="/dashboard/settings"
                    className="rounded-md px-4 py-2 text-sm font-semibold text-ink/75 transition hover:text-ink"
                  >
                    Settings
                  </Link>
                  <form action={signOutAction}>
                    <button className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink/90">
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link
                    href="/pricing"
                    className="rounded-md px-4 py-2 text-sm font-semibold text-ink/75 transition hover:text-ink"
                  >
                    Pricing
                  </Link>
                  <Link
                    href="/login"
                    className="rounded-md px-4 py-2 text-sm font-semibold text-ink/75 transition hover:text-ink"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/signup"
                    className="rounded-md bg-moss px-4 py-2 text-sm font-semibold text-white transition hover:bg-moss/90"
                  >
                    Start tracking free
                  </Link>
                </>
              )}
            </div>
          </nav>
        </header>
        {children}
        <footer className="border-t border-ink/10 bg-paper/80">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-6 text-sm text-ink/55 sm:flex-row sm:items-center sm:justify-between">
            <p>LaunchRadar analyzes public pages only.</p>
            <div className="flex flex-wrap gap-4">
              <Link href="/bot" className="font-semibold hover:text-ink">
                Bot
              </Link>
              <Link href="/privacy" className="font-semibold hover:text-ink">
                Privacy
              </Link>
              <Link href="/terms" className="font-semibold hover:text-ink">
                Terms
              </Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
