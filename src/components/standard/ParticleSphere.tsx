import { useEffect, useRef } from "react";

/** Decorative only: the canvas owns its work and never gates access to copy. */
export default function ParticleSphere({ enabled }: { enabled: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let context: CanvasRenderingContext2D | null;
    try { context = canvas.getContext("2d"); } catch { return; }
    if (!context) return;
    const ctx = context;
    let width = 0, height = 0, frame = 0, angle = 0, last = 0;
    let visible = false;
    let pointerX = 0, pointerY = 0;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const points = Array.from({ length: 520 }, (_, i) => {
      const y = 1 - (i / 519) * 2;
      const ring = Math.sqrt(1 - y * y);
      const theta = i * Math.PI * (3 - Math.sqrt(5));
      return { x: Math.cos(theta) * ring, y, z: Math.sin(theta) * ring };
    });
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const mobile = width < 650;
      const radius = Math.min(mobile ? width * .53 : width * .23, 290);
      const cx = width * (mobile ? .80 : .76) + pointerX * 9;
      const cy = mobile ? 170 : 210 + pointerY * 8;
      ctx.strokeStyle = "rgba(230,173,125,.12)";
      ctx.lineWidth = .6;
      for (let ring = 0; ring < 3; ring++) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, radius * (1.02 + ring * .08), radius * .37, -.5 + ring * .45, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (let i = 0; i < points.length; i += mobile ? 2 : 1) {
        const p = points[i];
        const x = p.x * Math.cos(angle) - p.z * Math.sin(angle);
        const z = p.x * Math.sin(angle) + p.z * Math.cos(angle);
        const alpha = .12 + ((z + 1) / 2) * .54;
        ctx.fillStyle = `rgba(230,173,125,${alpha})`;
        ctx.beginPath();
        ctx.arc(cx + x * radius, cy + p.y * radius, .5 + (z + 1) * .6, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    const tick = (time: number) => {
      angle += Math.min(time - (last || time), 50) * .000075;
      last = time;
      draw();
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      if (enabled && visible && !document.hidden) frame = requestAnimationFrame(tick);
      else draw();
    };
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = bounds.width; height = bounds.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw();
    };
    resize();
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : undefined;
    resizeObserver?.observe(canvas);
    const observer = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting; sync();
    }) : undefined;
    if (observer) observer.observe(canvas);
    // Without visibility observation, use the static view instead of an unbounded loop.
    const move = (event: PointerEvent) => {
      if (!enabled || !visible || !finePointer) return;
      const box = canvas.getBoundingClientRect();
      pointerX = (event.clientX - box.left) / width - .5;
      pointerY = (event.clientY - box.top) / height - .5;
    };
    const parent = canvas.parentElement;
    parent?.addEventListener("pointermove", move);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("resize", resize);
    sync();
    return () => {
      cancelAnimationFrame(frame); observer?.disconnect(); resizeObserver?.disconnect();
      parent?.removeEventListener("pointermove", move);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("resize", resize);
    };
  }, [enabled]);
  return <canvas ref={canvasRef} className="standard-sphere" aria-hidden="true" />;
}
