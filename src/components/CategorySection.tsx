import { useState } from "react";
import type { Article } from "../types";
import ArticleCard from "./ArticleCard";

export default function CategorySection({
  category,
  articles,
}: {
  category: string;
  articles: Article[];
}) {
  const [open, setOpen] = useState(true);

  return (
    <section className="mb-6">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 border-b border-slate-200 pb-1.5 text-left"
      >
        <span className="text-slate-400">{open ? "▾" : "▸"}</span>
        <h2 className="text-lg font-bold text-slate-800">{category}</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
          {articles.length}
        </span>
      </button>
      {open && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {articles.map((a) => (
            <ArticleCard key={a.url} article={a} />
          ))}
        </div>
      )}
    </section>
  );
}
