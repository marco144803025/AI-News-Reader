import type { Tags } from "../types";

const GROUP_STYLES: Record<keyof Tags, string> = {
  topics:
    "border-[rgba(240,246,252,0.08)] bg-surface-2 text-ink-secondary",
  traits:
    "border-[rgba(227,179,65,0.18)] bg-[rgba(227,179,65,0.06)] text-ember",
  entities:
    "border-[rgba(88,166,255,0.18)] bg-[rgba(88,166,255,0.08)] text-accent",
};

export default function TagChips({ tags }: { tags: Tags }) {
  const entries: { group: keyof Tags; value: string }[] = [
    ...tags.topics.map((value) => ({ group: "topics" as const, value })),
    ...tags.traits.map((value) => ({ group: "traits" as const, value })),
    ...tags.entities.map((value) => ({ group: "entities" as const, value })),
  ];
  if (entries.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-1">
      {entries.map(({ group, value }) => (
        <span
          key={`${group}:${value}`}
          className={`rounded border px-1.5 py-0.5 font-mono text-[10px] tracking-wide ${GROUP_STYLES[group]}`}
        >
          {value}
        </span>
      ))}
    </div>
  );
}
