import OffsetPanel from "./OffsetPanel";
import { LABELS } from "./copy";

// Shape of the F8 daily brief. F8 owns the canonical type in src/types.ts once
// it lands; this structural type keeps the slot decoupled until then.
export type BriefLike = {
  generatedAt: string;
  bullets: { text: string; refs: string[] }[];
};

export default function BulletinPanel({ brief }: { brief: BriefLike }) {
  if (brief.bullets.length === 0) return null;
  return (
    <div className="mt-6">
      <OffsetPanel slab="red" surface="ink" className="p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-poster text-sm tracking-[0.16em] text-press-red-bright">
            {LABELS.bulletinKicker}
          </span>
          <span className="font-wire text-[11px] text-paper/50">
            TL;DR · {formatTime(brief.generatedAt)}
          </span>
        </div>
        {brief.bullets.map((bullet, i) => (
          <p
            key={i}
            className="mt-2.5 font-press text-[13px] leading-relaxed text-paper"
          >
            {bullet.text}
            {bullet.refs.map((url, j) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="ml-1 font-wire text-[11px] text-press-red-bright hover:text-paper-bright focus-visible:outline-2 focus-visible:outline-press-red-bright"
              >
                [{j + 1}]
              </a>
            ))}
          </p>
        ))}
      </OffsetPanel>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
}
