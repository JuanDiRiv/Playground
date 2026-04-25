import Link from "next/link";
import { notFound } from "next/navigation";
import { Brain, Code2, Zap } from "lucide-react";
import { TopicSlugSchema } from "@/lib/schemas/content";
import {
  getTopic,
  listChallenges,
  listExercises,
  listQuestions,
} from "@/lib/content/queries";

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "bg-emerald-500/15 text-emerald-300",
  medium: "bg-amber-500/15 text-amber-300",
  hard: "bg-red-500/15 text-red-300",
};

type Tab = "qa" | "exercises" | "challenges";

export default async function TopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const { tab } = await searchParams;

  const parsed = TopicSlugSchema.safeParse(slug);
  if (!parsed.success) notFound();
  const topicSlug = parsed.data;

  const [topic, questions, exercises, challenges] = await Promise.all([
    getTopic(topicSlug),
    listQuestions(topicSlug),
    listExercises(topicSlug),
    listChallenges(topicSlug),
  ]);

  if (!topic) notFound();

  const activeTab: Tab = (
    ["qa", "exercises", "challenges"].includes(tab ?? "")
      ? (tab as Tab)
      : "qa"
  );

  return (
    <div className="space-y-8">
      <header>
        <Link
          href="/topics"
          className="text-sm text-fg-muted hover:text-fg"
        >
          ← Topics
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {topic.name}
        </h1>
        <p className="mt-1 text-fg-muted">{topic.description}</p>
      </header>

      <nav className="flex gap-1 border-b border-border">
        <TabLink
          slug={topicSlug}
          tab="qa"
          active={activeTab === "qa"}
          icon={Brain}
          label="Q&A"
          count={questions.length}
        />
        <TabLink
          slug={topicSlug}
          tab="exercises"
          active={activeTab === "exercises"}
          icon={Code2}
          label="Exercises"
          count={exercises.length}
        />
        <TabLink
          slug={topicSlug}
          tab="challenges"
          active={activeTab === "challenges"}
          icon={Zap}
          label="Challenges"
          count={challenges.length}
        />
      </nav>

      {activeTab === "qa" ? (
        <ItemList
          basePath={`/topics/${topicSlug}/qa`}
          empty="No questions yet."
          items={questions.map((q) => ({
            id: q.id,
            title: q.prompt,
            difficulty: q.difficulty,
          }))}
        />
      ) : null}
      {activeTab === "exercises" ? (
        <ItemList
          basePath="/exercises"
          empty="No exercises yet."
          items={exercises.map((e) => ({
            id: e.id,
            title: e.title,
            difficulty: e.difficulty,
            description: e.description,
          }))}
        />
      ) : null}
      {activeTab === "challenges" ? (
        <ItemList
          basePath="/challenges"
          empty="No challenges yet."
          items={challenges.map((c) => ({
            id: c.id,
            title: c.title,
            difficulty: c.difficulty,
            description: c.description,
          }))}
        />
      ) : null}
    </div>
  );
}

function TabLink({
  slug,
  tab,
  active,
  icon: Icon,
  label,
  count,
}: {
  slug: string;
  tab: Tab;
  active: boolean;
  icon: typeof Brain;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={`/topics/${slug}?tab=${tab}`}
      className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
        active
          ? "border-brand-500 text-fg"
          : "border-transparent text-fg-muted hover:text-fg"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
      <span className="rounded-full bg-bg-muted px-1.5 text-[10px] text-fg-muted">
        {count}
      </span>
    </Link>
  );
}

function ItemList({
  items,
  basePath,
  empty,
}: {
  items: { id: string; title: string; difficulty: string; description?: string }[];
  basePath: string;
  empty: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-bg-elevated p-8 text-center text-fg-muted">
        {empty}
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`${basePath}/${item.id}`}
            className="flex items-start justify-between gap-4 rounded-xl border border-border bg-bg-elevated p-4 transition hover:border-brand-500"
          >
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 font-medium">{item.title}</div>
              {item.description ? (
                <div className="mt-1 line-clamp-1 text-sm text-fg-muted">
                  {item.description}
                </div>
              ) : null}
            </div>
            <span
              className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium ${DIFFICULTY_COLOR[item.difficulty]}`}
            >
              {item.difficulty}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
