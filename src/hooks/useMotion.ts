import { useEffect, useState } from "react";

const MOTION_KEY = "ai-briefing-motion";

export function useMotion() {
  const [preferred, setPreferred] = useState(() => {
    try { return window.localStorage.getItem(MOTION_KEY) !== "off"; }
    catch { return true; }
  });
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const toggle = () => {
    const next = !preferred;
    setPreferred(next);
    try { window.localStorage.setItem(MOTION_KEY, next ? "on" : "off"); }
    catch { /* Session-only preference when storage is unavailable. */ }
  };
  return { enabled: preferred && !reduced, reduced, toggle };
}
