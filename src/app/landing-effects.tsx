"use client";
import { useEffect, useRef } from "react";

export function LandingEffects() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      cv.width = window.innerWidth;
      cv.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const blobs = [
      { x: 0.25, y: 0.3,  rx: 0.38, ry: 0.22, speed: 0.00018, phase: 0.0, alpha: 0.11, orbitX: 0.12, orbitY: 0.08 },
      { x: 0.7,  y: 0.6,  rx: 0.3,  ry: 0.18, speed: 0.00024, phase: 1.8, alpha: 0.08, orbitX: 0.09, orbitY: 0.13 },
      { x: 0.5,  y: 0.15, rx: 0.45, ry: 0.14, speed: 0.00015, phase: 3.2, alpha: 0.07, orbitX: 0.06, orbitY: 0.10 },
      { x: 0.15, y: 0.75, rx: 0.28, ry: 0.2,  speed: 0.0002,  phase: 5.1, alpha: 0.08, orbitX: 0.10, orbitY: 0.06 },
      { x: 0.8,  y: 0.25, rx: 0.22, ry: 0.26, speed: 0.00028, phase: 0.9, alpha: 0.06, orbitX: 0.07, orbitY: 0.09 },
    ];

    const dots = Array.from({ length: 40 }, () => ({
      x: Math.random() * cv.width,
      y: Math.random() * cv.height,
      r: Math.random() * 0.9 + 0.2,
      phase: Math.random() * Math.PI * 2,
      speed: 0.002 + Math.random() * 0.003,
    }));

    let raf = 0;
    const draw = () => {
      const W = cv.width;
      const H = cv.height;
      ctx.clearRect(0, 0, W, H);

      blobs.forEach((b) => {
        b.phase += b.speed * 16;
        const cx = (b.x + Math.sin(b.phase * 1.3) * b.orbitX) * W;
        const cy = (b.y + Math.cos(b.phase * 0.9) * b.orbitY) * H;
        const rx = b.rx * W;
        const ry = b.ry * H;
        const pulse = 1 + Math.sin(b.phase * 2.1) * 0.12;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry) * pulse);
        grad.addColorStop(0, `rgba(184,245,90,${b.alpha})`);
        grad.addColorStop(0.4, `rgba(120,210,40,${b.alpha * 0.5})`);
        grad.addColorStop(1, "rgba(80,180,20,0)");
        ctx.save();
        ctx.scale(1, ry / rx);
        ctx.beginPath();
        ctx.arc(cx, cy * (rx / ry), rx * pulse, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
      });

      dots.forEach((d) => {
        d.phase += d.speed;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(184,245,90,${0.06 + Math.sin(d.phase) * 0.04})`;
        ctx.fill();
      });

      raf = requestAnimationFrame(draw);
    };
    draw();

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll(".reveal").forEach((el) => obs.observe(el));

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      obs.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}
