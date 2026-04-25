import Link from "next/link";
import { ArrowRight, Brain, Code2, Zap } from "lucide-react";

const FEATURES = [
  {
    icon: Brain,
    title: "Interview Q&A",
    description:
      "Open-ended questions evaluated by AI with score, strengths and gaps.",
  },
  {
    icon: Code2,
    title: "In-browser exercises",
    description:
      "Monaco editor with live preview (sandbox) and unit tests in a Web Worker.",
  },
  {
    icon: Zap,
    title: "Code challenges",
    description:
      "Timed challenges with progressive AI hints and personal best times.",
  },
];

const STACK = [
  "Next.js 16",
  "React 19",
  "Tailwind 4",
  "Firebase",
  "OpenAI gpt-5.4-mini",
];

export default function HomePage() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(99,102,241,0.18),transparent_70%)]"
      />
      <section className="relative mx-auto max-w-5xl px-6 pt-20 pb-16 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-300">
          ✦ Practice tech interviews with AI
        </span>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          Master{" "}
          <span className="bg-gradient-to-r from-brand-300 to-purple-400 bg-clip-text text-transparent">
            HTML, CSS, JS, React &amp; more
          </span>{" "}
          with hands-on practice.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-fg-muted">
          Q&amp;A, in-browser coding exercises and timed challenges — all
          powered by AI feedback and progressive hints.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-500"
          >
            Get started <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/topics"
            className="rounded-lg border border-border bg-bg-elevated px-5 py-2.5 text-sm font-medium text-fg transition hover:border-border-strong"
          >
            Browse topics
          </Link>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-2 text-xs text-fg-muted">
          {STACK.map((item) => (
            <span
              key={item}
              className="rounded-full border border-border bg-bg-elevated px-3 py-1"
            >
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-20 sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="rounded-2xl border border-border bg-bg-elevated p-5 transition hover:border-border-strong"
          >
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-500/10 text-brand-300">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-fg-muted">{description}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
