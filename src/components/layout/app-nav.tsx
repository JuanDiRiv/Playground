import Link from "next/link";
import Image from "next/image";
import { Sparkles } from "lucide-react";
import { getSessionUser } from "@/lib/firebase/auth-server";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/practice", label: "Practice" },
  { href: "/topics", label: "Topics" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export async function AppNav() {
  const user = await getSessionUser();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 text-white text-sm font-bold">
            T
          </span>
          <span className="font-semibold tracking-tight">TechPractice</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-fg-muted md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition hover:text-fg"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 rounded-full border border-border bg-bg-elevated px-3 py-1 text-xs text-fg-muted md:inline-flex">
            <Sparkles className="h-3.5 w-3.5 text-brand-300" />
            AI-powered
          </span>
          {user ? (
            <Link
              href="/profile"
              className="flex items-center gap-2 rounded-full border border-border bg-bg-elevated px-2 py-1 text-sm transition hover:border-border-strong"
            >
              {user.photoURL ? (
                <Image
                  src={user.photoURL}
                  alt={user.displayName ?? "avatar"}
                  width={24}
                  height={24}
                  className="rounded-full"
                />
              ) : (
                <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-500 text-[11px] font-bold text-white">
                  {(user.displayName ?? user.email ?? "?")
                    .slice(0, 1)
                    .toUpperCase()}
                </span>
              )}
              <span className="hidden max-w-[120px] truncate text-fg-muted sm:inline">
                {user.displayName ?? user.email}
              </span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-500"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
