import type { ReactNode } from "react";

// Tape-strip button. The outer button stays unrotated (rectangular hit-area);
// only the inner visual strip tilts.
export default function TapeChip({
  active = false,
  tilt = 0,
  onClick,
  children,
}: {
  active?: boolean;
  tilt?: number;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-press-red-deep"
    >
      <span
        className={`inline-block px-2.5 py-1 font-wire text-[11px] tracking-[0.08em] transition-colors ${
          active
            ? "bg-press-red-deep text-paper-bright"
            : "bg-ink-press text-paper-bright group-hover:bg-press-red-deep"
        }`}
        style={tilt ? { rotate: `calc(var(--tilt-unit) * ${tilt})` } : undefined}
      >
        {children}
      </span>
    </button>
  );
}
