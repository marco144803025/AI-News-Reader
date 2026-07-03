// Lineage-neutral SVG sparkline — stroke follows currentColor.
export default function Sparkline({
  values,
  className = "",
  label,
}: {
  values: number[];
  className?: string;
  label: string;
}) {
  if (values.length < 2) return null;
  const w = 100;
  const h = 28;
  const max = Math.max(...values, 1);
  const points = values
    .map(
      (v, i) =>
        `${((i / (values.length - 1)) * w).toFixed(2)},${(h - 1 - (v / max) * (h - 2)).toFixed(2)}`
    )
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label={label}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
