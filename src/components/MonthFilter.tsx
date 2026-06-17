"use client";

// ─── Seletor de mês (mesmo visual/comportamento do topo da home) ─────────────
// Navega QUALQUER mês do calendário (‹ ›, sempre habilitado) + input nativo.
// value/onChange em "YYYY-MM". Reusado na home e no /cards pra manter consistência.

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CSSProperties, MouseEvent } from "react";

function shift(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const btn: CSSProperties = {
  background: "transparent", border: "none", color: "rgba(255,255,255,0.5)",
  cursor: "pointer", padding: "6px 8px", display: "flex", alignItems: "center", transition: "color .15s",
};
const hover = (e: MouseEvent<HTMLButtonElement>, on: boolean) =>
  (e.currentTarget.style.color = on ? "#fff" : "rgba(255,255,255,0.5)");

export function MonthFilter({ value, onChange }: { value: string; onChange: (m: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, overflow: "hidden" }}>
      <button onClick={() => onChange(shift(value, -1))} style={btn} onMouseEnter={(e) => hover(e, true)} onMouseLeave={(e) => hover(e, false)} aria-label="Mês anterior">
        <ChevronLeft size={14} />
      </button>
      <input
        type="month"
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        style={{ background: "transparent", border: "none", color: "#fff", fontSize: 13, padding: "6px 4px", cursor: "pointer", outline: "none" }}
      />
      <button onClick={() => onChange(shift(value, 1))} style={btn} onMouseEnter={(e) => hover(e, true)} onMouseLeave={(e) => hover(e, false)} aria-label="Próximo mês">
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
