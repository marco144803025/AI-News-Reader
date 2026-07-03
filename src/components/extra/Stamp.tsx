export default function Stamp({
  label,
  small = false,
}: {
  label: string;
  small?: boolean;
}) {
  return (
    <span
      className={`inline-block border-2 border-press-red-deep font-poster tracking-[0.14em] text-press-red-deep ${
        small ? "px-1.5 text-[11px]" : "px-2 py-0.5 text-xs"
      }`}
      style={{ rotate: "var(--stamp-tilt)" }}
    >
      {label}
    </span>
  );
}
