import type { ReactNode } from "react";

// Offset-print device: a solid slab sits behind the panel, misaligned by 6px
// — flat color only, no shadows. Panels stay unrotated so links inside keep
// rectangular hit-areas; tilt lives on decorative elements around them.
export default function OffsetPanel({
  slab = "ink",
  surface = "paper",
  className = "",
  children,
}: {
  slab?: "ink" | "red";
  surface?: "paper" | "ink";
  className?: string;
  children: ReactNode;
}) {
  const slabCls = slab === "red" ? "bg-press-red-deep" : "bg-ink-press";
  const surfaceCls =
    surface === "ink" ? "bg-ink-press" : "border-2 border-ink-press bg-paper-bright";
  return (
    <div className={`ml-1.5 mt-1.5 ${slabCls}`}>
      <div className={`-translate-x-1.5 -translate-y-1.5 ${surfaceCls} ${className}`}>
        {children}
      </div>
    </div>
  );
}
