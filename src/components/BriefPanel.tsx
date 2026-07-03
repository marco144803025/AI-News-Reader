import type { Brief } from "../types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function BriefPanel({ brief }: { brief: Brief }) {
  if (brief.bullets.length === 0) return null;
  return (
    <section className="mb-8 rounded border border-[rgba(240,246,252,0.07)] border-l-2 border-l-ember bg-surface-1 p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-ink-secondary">
          {"// today's brief"}
        </h2>
        <span className="font-mono text-[10px] text-ink-muted">
          {formatDate(brief.generatedAt)}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {brief.bullets.map((bullet, i) => (
          <li key={i} className="text-sm leading-relaxed text-ink-secondary">
            {bullet.text}
            {bullet.refs.map((url, j) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="ml-1 font-mono text-[10px] text-accent hover:underline"
              >
                [{j + 1}]
              </a>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
