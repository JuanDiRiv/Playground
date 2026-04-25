import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { listTopics } from "@/lib/content/queries";

const COLOR_MAP: Record<string, string> = {
  orange: "bg-orange-500/20 text-orange-300",
  blue: "bg-blue-500/20 text-blue-300",
  yellow: "bg-yellow-500/20 text-yellow-300",
  cyan: "bg-cyan-500/20 text-cyan-300",
  zinc: "bg-zinc-500/20 text-zinc-200",
  indigo: "bg-indigo-500/20 text-indigo-300",
  emerald: "bg-emerald-500/20 text-emerald-300",
};

export default async function TopicsPage() {
  const topics = await listTopics();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Topics</h1>
        <p className="mt-1 text-fg-muted">
          Pick a technology to start practicing.
        </p>
      </header>

      {topics.length === 0 ? (
        <EmptyState />
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {topics.map((topic) => (
            <Link
              key={topic.slug}
              href={`/topics/${topic.slug}`}
              className="group rounded-2xl border border-border bg-bg-elevated p-5 transition hover:border-brand-500"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`rounded-md px-2 py-1 text-xs font-bold ${COLOR_MAP[topic.color] ?? "bg-bg-muted text-fg"}`}
                >
                  {topic.name}
                </span>
                <ArrowRight className="h-4 w-4 text-fg-subtle transition group-hover:text-brand-300" />
              </div>
              <h3 className="mt-3 font-semibold">{topic.name}</h3>
              <p className="mt-1 text-sm text-fg-muted">{topic.description}</p>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-bg-elevated p-10 text-center">
      <p className="text-fg-muted">
        No topics yet. Run{" "}
        <code className="rounded bg-bg-muted px-1.5 py-0.5 text-fg">
          npx tsx scripts/seed.ts
        </code>{" "}
        to seed initial content.
      </p>
    </div>
  );
}
