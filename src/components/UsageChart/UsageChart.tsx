// Single-series daily requests chart. Plain SVG: one blue line on hairline gridlines.
export default function UsageChart({ series, label }: { series: { date: string; value: number }[]; label: string }) {
  const w = 1000;
  const h = 260;
  const pad = { top: 16, right: 8, bottom: 28, left: 44 };
  const max = Math.max(1, ...series.map((s) => s.value));
  const niceMax = Math.ceil(max / 4) * 4 || 4;
  const x = (i: number) => pad.left + (i * (w - pad.left - pad.right)) / Math.max(1, series.length - 1);
  const y = (v: number) => pad.top + (1 - v / niceMax) * (h - pad.top - pad.bottom);
  const line = series.map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(s.value).toFixed(1)}`).join(" ");
  const ticks = [0, niceMax / 4, niceMax / 2, (3 * niceMax) / 4, niceMax];
  const labelEvery = Math.ceil(series.length / 7);
  const total = series.reduce((n, s) => n + s.value, 0);

  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label={`${label}: ${total} requests over ${series.length} days`} style={{ display: "block", overflow: "visible" }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={w - pad.right} y1={y(t)} y2={y(t)} stroke="var(--y-hairline)" />
            <text x={pad.left - 10} y={y(t) + 4} textAnchor="end" fontSize="12" fill="var(--y-muted)">{t}</text>
          </g>
        ))}
        {series.map((s, i) =>
          i % labelEvery === 0 || i === series.length - 1 ? (
            <text key={s.date} x={x(i)} y={h - 6} textAnchor="middle" fontSize="12" fill="var(--y-muted)">
              {new Date(`${s.date}T00:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" })}
            </text>
          ) : null,
        )}
        <path d={line} fill="none" stroke="var(--y-blue)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {series.map((s, i) => (
          <circle key={s.date} cx={x(i)} cy={y(s.value)} r="3.5" fill="var(--y-canvas)" stroke="var(--y-blue)" strokeWidth="2">
            <title>{`${s.date}: ${s.value} requests`}</title>
          </circle>
        ))}
      </svg>
    </figure>
  );
}
