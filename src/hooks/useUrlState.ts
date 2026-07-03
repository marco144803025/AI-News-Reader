import { useCallback, useEffect, useState } from "react";
import { EMPTY_FILTER, type FilterState } from "../lib/filter";

function parseList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function readFromUrl(): FilterState {
  if (typeof window === "undefined") return EMPTY_FILTER;
  const p = new URLSearchParams(window.location.search);
  return {
    query: p.get("q") ?? "",
    category: p.get("category") ?? "All",
    topics: parseList(p.get("topics")),
    traits: parseList(p.get("traits")),
    entities: parseList(p.get("entities")),
  };
}

const FILTER_KEYS = ["q", "category", "topics", "traits", "entities"];

function writeToUrl(state: FilterState) {
  // Start from the current URL so non-filter params (e.g. `theme`) survive.
  const p = new URLSearchParams(window.location.search);
  for (const key of FILTER_KEYS) p.delete(key);
  if (state.query.trim()) p.set("q", state.query.trim());
  if (state.category && state.category !== "All")
    p.set("category", state.category);
  if (state.topics.length) p.set("topics", state.topics.join(","));
  if (state.traits.length) p.set("traits", state.traits.join(","));
  if (state.entities.length) p.set("entities", state.entities.join(","));

  const qs = p.toString();
  const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== current) {
    window.history.pushState({}, "", next);
  }
}

export function useUrlState(): [FilterState, (next: FilterState) => void] {
  const [state, setState] = useState<FilterState>(readFromUrl);

  useEffect(() => {
    const onPop = () => setState(readFromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const update = useCallback((next: FilterState) => {
    setState(next);
    writeToUrl(next);
  }, []);

  return [state, update];
}
