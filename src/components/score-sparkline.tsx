import type { DailyScorePoint } from "@/lib/content/qa-history";

/**
 * Compact SVG sparkline of daily average Q&A score (0-5) over the given window.
 * Renders nothing useful if all points are zero (no attempts).
 */
export function ScoreSparkline({
    points,
    height = 60,
    width = 320,
}: {
    points: DailyScorePoint[];
    height?: number;
    width?: number;
}) {
    if (points.length === 0) return null;

    const totalAttempts = points.reduce((s, p) => s + p.attempts, 0);
    const avg =
        totalAttempts > 0
            ? points.reduce((s, p) => s + p.avgScore * p.attempts, 0) /
            totalAttempts
            : 0;

    const padX = 4;
    const padY = 4;
    const innerW = width - padX * 2;
    const innerH = height - padY * 2;
    const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;

    // Y axis is fixed 0..5 (Q&A score range).
    const yFor = (score: number) => padY + innerH - (score / 5) * innerH;
    const xFor = (i: number) => padX + i * stepX;

    const path = points
        .map((p, i) => {
            const x = xFor(i);
            const y = yFor(p.avgScore);
            return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");

    const areaPath = `${path} L${xFor(points.length - 1).toFixed(1)},${(padY + innerH).toFixed(1)} L${xFor(0).toFixed(1)},${(padY + innerH).toFixed(1)} Z`;

    const last = points[points.length - 1];
    const lastWithData = [...points].reverse().find((p) => p.attempts > 0);

    return (
        <div className="rounded-2xl border border-border bg-bg-elevated p-4">
            <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-medium text-fg">
                    Q&A activity · last {points.length} days
                </h3>
                <div className="text-xs text-fg-muted">
                    {totalAttempts === 0 ? (
                        <span>No attempts yet</span>
                    ) : (
                        <>
                            <span className="tabular-nums text-fg">
                                {avg.toFixed(2)}
                            </span>
                            <span className="ml-1">avg · {totalAttempts} attempts</span>
                        </>
                    )}
                </div>
            </div>

            <svg
                viewBox={`0 0 ${width} ${height}`}
                className="mt-2 h-[60px] w-full"
                preserveAspectRatio="none"
                role="img"
                aria-label={`Q&A score history, last ${points.length} days`}
            >
                {/* Baseline at y=0 */}
                <line
                    x1={padX}
                    x2={width - padX}
                    y1={padY + innerH}
                    y2={padY + innerH}
                    stroke="currentColor"
                    strokeOpacity={0.15}
                    strokeWidth={1}
                />
                {/* Reference line at score 3 (passing) */}
                <line
                    x1={padX}
                    x2={width - padX}
                    y1={yFor(3)}
                    y2={yFor(3)}
                    stroke="currentColor"
                    strokeOpacity={0.1}
                    strokeDasharray="2 3"
                    strokeWidth={1}
                />
                {totalAttempts > 0 ? (
                    <>
                        <path
                            d={areaPath}
                            fill="rgb(99 102 241)"
                            fillOpacity={0.15}
                        />
                        <path
                            d={path}
                            fill="none"
                            stroke="rgb(129 140 248)"
                            strokeWidth={1.5}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                        />
                        {points.map((p, i) =>
                            p.attempts > 0 ? (
                                <circle
                                    key={p.day}
                                    cx={xFor(i)}
                                    cy={yFor(p.avgScore)}
                                    r={1.8}
                                    fill="rgb(165 180 252)"
                                >
                                    <title>
                                        {p.day} · {p.attempts} attempt
                                        {p.attempts === 1 ? "" : "s"} · avg {p.avgScore.toFixed(2)}
                                    </title>
                                </circle>
                            ) : null,
                        )}
                    </>
                ) : null}
            </svg>

            {lastWithData ? (
                <p className="mt-1 text-xs text-fg-muted">
                    Latest:{" "}
                    <span className="text-fg">{lastWithData.day}</span> ·{" "}
                    {lastWithData.avgScore.toFixed(2)} avg
                </p>
            ) : last ? (
                <p className="mt-1 text-xs text-fg-subtle">
                    Submit some Q&A answers to start tracking progress.
                </p>
            ) : null}
        </div>
    );
}
