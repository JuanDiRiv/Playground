import Link from "next/link";
import Image from "next/image";
import { Brain, Code2, LayoutDashboard, User } from "lucide-react";
import { getSessionUser } from "@/lib/firebase/auth-server";

export async function AppHeader() {
    const user = await getSessionUser();

    return (
        <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-3">
                <Link
                    href="/dashboard"
                    className="flex items-center gap-2 text-sm font-semibold tracking-tight"
                >
                    <span className="inline-grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-brand-500 to-purple-500 text-white">
                        <Brain className="h-4 w-4" />
                    </span>
                    TechPractice
                </Link>

                <nav className="flex items-center gap-1 text-sm">
                    <NavLink href="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />}>
                        Dashboard
                    </NavLink>
                    <NavLink href="/topics" icon={<Code2 className="h-4 w-4" />}>
                        Topics
                    </NavLink>
                    <Link
                        href="/profile"
                        className="ml-2 inline-flex items-center gap-2 rounded-full border border-border bg-bg-elevated p-1 pr-3 text-xs transition hover:border-border-strong"
                    >
                        {user?.photoURL ? (
                            <Image
                                src={user.photoURL}
                                alt=""
                                width={24}
                                height={24}
                                className="rounded-full"
                            />
                        ) : (
                            <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-500/20 text-brand-300">
                                <User className="h-3 w-3" />
                            </span>
                        )}
                        <span className="hidden text-fg-muted sm:inline">
                            {user?.displayName?.split(" ")[0] ?? "Profile"}
                        </span>
                    </Link>
                </nav>
            </div>
        </header>
    );
}

function NavLink({
    href,
    icon,
    children,
}: {
    href: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <Link
            href={href}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-fg-muted transition hover:bg-bg-elevated hover:text-fg"
        >
            {icon}
            <span className="hidden sm:inline">{children}</span>
        </Link>
    );
}
