import Link from "next/link";
import { notFound } from "next/navigation";
import { Brain, CheckCircle2, Code2, Search, Target, Zap } from "lucide-react";
import { TopicSlugSchema, type Difficulty } from "@/lib/schemas/content";
import {
    getTopic,
    listChallenges,
    listExercises,
    listQuestions,
} from "@/lib/content/queries";
import { getTopicProgress } from "@/lib/content/topic-progress";
import { getSessionUser } from "@/lib/firebase/auth-server";
import { formatMinSec } from "@/lib/utils/format";

const DIFFICULTY_COLOR: Record<string, string> = {
    easy: "bg-emerald-500/15 text-emerald-300",
    medium: "bg-amber-500/15 text-amber-300",
    hard: "bg-red-500/15 text-red-300",
};

type Tab = "qa" | "exercises" | "challenges";
type StatusFilter = "all" | "todo" | "done";
type DiffFilter = "all" | Difficulty;

type ListItem = {
    id: string;
    title: string;
    description?: string;
    difficulty: Difficulty;
    done: boolean;
    badge?: { label: string; tone: "good" | "warn" | "muted" };
};

export default async function TopicPage({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{
        tab?: string;
        q?: string;
        status?: string;
        diff?: string;
    }>;
}) {
    const { slug } = await params;
    const sp = await searchParams;

    const parsed = TopicSlugSchema.safeParse(slug);
    if (!parsed.success) notFound();
    const topicSlug = parsed.data;

    const user = await getSessionUser();
    if (!user) notFound();

    const [topic, questions, exercises, challenges, progress] = await Promise.all([
        getTopic(topicSlug),
        listQuestions(topicSlug),
        listExercises(topicSlug),
        listChallenges(topicSlug),
        getTopicProgress(user.uid, topicSlug),
    ]);

    if (!topic) notFound();

    const activeTab: Tab = (
        ["qa", "exercises", "challenges"].includes(sp.tab ?? "")
            ? (sp.tab as Tab)
            : "qa"
    );
    const status: StatusFilter = (
        ["all", "todo", "done"].includes(sp.status ?? "") ? sp.status : "all"
    ) as StatusFilter;
    const diff: DiffFilter = (
        ["all", "easy", "medium", "hard"].includes(sp.diff ?? "")
            ? sp.diff
            : "all"
    ) as DiffFilter;
    const query = (sp.q ?? "").trim().toLowerCase();

    const qaItems: ListItem[] = questions.map((q) => {
        const p = progress.qa.get(q.id);
        const done = (p?.bestScore ?? 0) === 5;
        return {
            id: q.id,
            title: q.prompt,
            difficulty: q.difficulty,
            done,
            badge: p
                ? {
                    label: `${p.bestScore}/5`,
                    tone: done ? "good" : p.bestScore >= 3 ? "warn" : "muted",
                }
                : undefined,
        };
    });

    const exerciseItems: ListItem[] = exercises.map((e) => {
        const p = progress.exercises.get(e.id);
        return {
            id: e.id,
            title: e.title,
            description: e.description,
            difficulty: e.difficulty,
            done: p?.passed ?? false,
        };
    });

    const challengeItems: ListItem[] = challenges.map((c) => {
        const p = progress.challenges.get(c.id);
        return {
            id: c.id,
            title: c.title,
            description: c.description,
            difficulty: c.difficulty,
            done: p?.passed ?? false,
            badge:
                p?.bestTimeSec != null
                    ? {
                        label: `best ${formatMinSec(p.bestTimeSec)}${p.onTime ? " ✓" : ""}`,
                        tone: p.onTime ? "good" : "warn",
                    }
                    : { label: `target ${formatMinSec(c.targetTimeSec)}`, tone: "muted" },
        };
    });

    const items =
        activeTab === "qa"
            ? qaItems
            : activeTab === "exercises"
                ? exerciseItems
                : challengeItems;

    const filtered = items.filter((it) => {
        if (status === "done" && !it.done) return false;
        if (status === "todo" && it.done) return false;
        if (diff !== "all" && it.difficulty !== diff) return false;
        if (
            query &&
            !it.title.toLowerCase().includes(query) &&
            !(it.description ?? "").toLowerCase().includes(query)
        ) {
            return false;
        }
        return true;
    });

    const basePath =
        activeTab === "qa"
            ? `/topics/${topicSlug}/qa`
            : activeTab === "exercises"
                ? `/topics/${topicSlug}/exercises`
                : `/topics/${topicSlug}/challenges`;

    function buildUrl(
        overrides: Partial<{ tab: Tab; status: string; diff: string; q: string }>,
    ) {
        const params = new URLSearchParams();
        const t = overrides.tab ?? activeTab;
        if (t !== "qa") params.set("tab", t);
        const s = overrides.status ?? status;
        if (s !== "all") params.set("status", s);
        const d = overrides.diff ?? diff;
        if (d !== "all") params.set("diff", d);
        const q = overrides.q ?? query;
        if (q) params.set("q", q);
        const qs = params.toString();
        return `/topics/${topicSlug}${qs ? `?${qs}` : ""}`;
    }

    const completeCount = items.filter((i) => i.done).length;

    return (
        <div className="space-y-6">
            <header>
                <Link href="/topics" className="text-sm text-fg-muted hover:text-fg">
                    ← Topics
                </Link>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                    {topic.name}
                </h1>
                <p className="mt-1 text-fg-muted">{topic.description}</p>
            </header>

            <nav
                className="flex gap-1 border-b border-border"
                aria-label="Section tabs"
            >
                <TabLink
                    href={buildUrl({ tab: "qa", status: "all", diff: "all", q: "" })}
                    active={activeTab === "qa"}
                    icon={Brain}
                    label="Q&A"
                    count={questions.length}
                />
                <TabLink
                    href={buildUrl({
                        tab: "exercises",
                        status: "all",
                        diff: "all",
                        q: "",
                    })}
                    active={activeTab === "exercises"}
                    icon={Code2}
                    label="Exercises"
                    count={exercises.length}
                />
                <TabLink
                    href={buildUrl({
                        tab: "challenges",
                        status: "all",
                        diff: "all",
                        q: "",
                    })}
                    active={activeTab === "challenges"}
                    icon={Zap}
                    label="Challenges"
                    count={challenges.length}
                />
            </nav>

            <section className="flex flex-col gap-3 rounded-xl border border-border bg-bg-elevated p-3 sm:flex-row sm:items-center sm:justify-between">
                <form
                    action={`/topics/${topicSlug}`}
                    method="GET"
                    className="flex flex-1 items-center gap-2"
                >
                    <input type="hidden" name="tab" value={activeTab} />
                    {status !== "all" ? (
                        <input type="hidden" name="status" value={status} />
                    ) : null}
                    {diff !== "all" ? (
                        <input type="hidden" name="diff" value={diff} />
                    ) : null}
                    <label className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-bg px-3 py-1.5 focus-within:border-brand-500">
                        <Search className="h-4 w-4 text-fg-subtle" aria-hidden />
                        <span className="sr-only">Search</span>
                        <input
                            type="search"
                            name="q"
                            defaultValue={query}
                            placeholder={`Search ${activeTab}…`}
                            className="w-full bg-transparent text-sm outline-none placeholder:text-fg-subtle"
                        />
                    </label>
                </form>

                <div className="flex flex-wrap items-center gap-2">
                    <FilterGroup
                        label="Status"
                        options={[
                            { value: "all", label: "All" },
                            { value: "todo", label: "Todo" },
                            { value: "done", label: "Done" },
                        ]}
                        active={status}
                        build={(value) => buildUrl({ status: value })}
                    />
                    <FilterGroup
                        label="Difficulty"
                        options={[
                            { value: "all", label: "All" },
                            { value: "easy", label: "E" },
                            { value: "medium", label: "M" },
                            { value: "hard", label: "H" },
                        ]}
                        active={diff}
                        build={(value) => buildUrl({ diff: value })}
                    />
                    <span className="hidden text-xs text-fg-muted sm:inline">
                        {completeCount}/{items.length} done
                    </span>
                </div>
            </section>

            <ItemList items={filtered} basePath={basePath} />
        </div>
    );
}

function TabLink({
    href,
    active,
    icon: Icon,
    label,
    count,
}: {
    href: string;
    active: boolean;
    icon: typeof Brain;
    label: string;
    count: number;
}) {
    return (
        <Link
            href={href}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${active
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

function FilterGroup<T extends string>({
    label,
    options,
    active,
    build,
}: {
    label: string;
    options: { value: T; label: string }[];
    active: T;
    build: (value: T) => string;
}) {
    return (
        <div className="flex items-center gap-1 rounded-lg border border-border bg-bg p-0.5">
            <span className="px-2 text-[10px] uppercase tracking-wide text-fg-subtle">
                {label}
            </span>
            {options.map((opt) => (
                <Link
                    key={opt.value}
                    href={build(opt.value)}
                    className={`rounded-md px-2 py-1 text-xs font-medium transition ${active === opt.value
                        ? "bg-brand-500/20 text-brand-200"
                        : "text-fg-muted hover:bg-bg-muted hover:text-fg"
                        }`}
                >
                    {opt.label}
                </Link>
            ))}
        </div>
    );
}

function ItemList({
    items,
    basePath,
}: {
    items: ListItem[];
    basePath: string;
}) {
    if (items.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-border bg-bg-elevated p-8 text-center text-fg-muted">
                No items match the current filters.
            </div>
        );
    }
    const TONE_CLASS: Record<NonNullable<ListItem["badge"]>["tone"], string> = {
        good: "bg-emerald-500/15 text-emerald-300",
        warn: "bg-amber-500/15 text-amber-300",
        muted: "bg-bg-muted text-fg-muted",
    };
    return (
        <ul className="space-y-2">
            {items.map((item) => (
                <li key={item.id}>
                    <Link
                        href={`${basePath}/${item.id}`}
                        className="flex items-start justify-between gap-4 rounded-xl border border-border bg-bg-elevated p-4 transition hover:border-brand-500"
                    >
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                {item.done ? (
                                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                                ) : (
                                    <Target className="h-4 w-4 shrink-0 text-fg-subtle" />
                                )}
                                <div className="line-clamp-2 font-medium">{item.title}</div>
                            </div>
                            {item.description ? (
                                <div className="mt-1 line-clamp-1 pl-6 text-sm text-fg-muted">
                                    {item.description}
                                </div>
                            ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                            {item.badge ? (
                                <span
                                    className={`rounded-md px-2 py-1 text-xs font-medium tabular-nums ${TONE_CLASS[item.badge.tone]}`}
                                >
                                    {item.badge.label}
                                </span>
                            ) : null}
                            <span
                                className={`rounded-md px-2 py-1 text-xs font-medium ${DIFFICULTY_COLOR[item.difficulty]}`}
                            >
                                {item.difficulty}
                            </span>
                        </div>
                    </Link>
                </li>
            ))}
        </ul>
    );
}
