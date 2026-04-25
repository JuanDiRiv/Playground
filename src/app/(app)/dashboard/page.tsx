import Link from "next/link";
import { getSessionUser } from "@/lib/firebase/auth-server";
import { ArrowRight } from "lucide-react";

const TOPIC_PLACEHOLDERS = [
    { slug: "html", label: "HTML", color: "bg-orange-500/20 text-orange-300" },
    { slug: "css", label: "CSS", color: "bg-blue-500/20 text-blue-300" },
    { slug: "javascript", label: "JavaScript", color: "bg-yellow-500/20 text-yellow-300" },
    { slug: "react", label: "React", color: "bg-cyan-500/20 text-cyan-300" },
    { slug: "nextjs", label: "Next.js", color: "bg-zinc-500/20 text-zinc-200" },
    { slug: "typescript", label: "TypeScript", color: "bg-blue-700/30 text-blue-200" },
    { slug: "node", label: "Node.js", color: "bg-emerald-500/20 text-emerald-300" },
];

export default async function DashboardPage() {
    const user = await getSessionUser();

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-1">
                <h1 className="text-3xl font-semibold tracking-tight">
                    Welcome back{user?.displayName ? `, ${user.displayName.split(" ")[0]}` : ""} 👋
                </h1>
                <p className="text-fg-muted">Pick a topic to start practicing.</p>
            </header>

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {TOPIC_PLACEHOLDERS.map((topic) => (
                    <Link
                        key={topic.slug}
                        href={`/topics/${topic.slug}`}
                        className="group rounded-2xl border border-border bg-bg-elevated p-5 transition hover:border-brand-500"
                    >
                        <div className="flex items-center justify-between">
                            <span className={`rounded-md px-2 py-1 text-xs font-bold ${topic.color}`}>
                                {topic.label}
                            </span>
                            <ArrowRight className="h-4 w-4 text-fg-subtle transition group-hover:text-brand-300" />
                        </div>
                        <h3 className="mt-3 font-semibold">{topic.label} fundamentals</h3>
                        <p className="mt-1 text-sm text-fg-muted">
                            Q&amp;A, exercises and challenges.
                        </p>
                        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-bg-muted">
                            <div className="h-full w-0 rounded-full bg-brand-500" />
                        </div>
                        <div className="mt-2 text-xs text-fg-subtle">No progress yet</div>
                    </Link>
                ))}
            </section>
        </div>
    );
}
