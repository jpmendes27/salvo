"use client";

import { type User } from "firebase/auth";
import {
  addDoc, collection, doc, onSnapshot,
  orderBy, query, serverTimestamp, updateDoc
} from "firebase/firestore";
import {
  ArrowLeft, CreditCard, Plane, Plus, Shield, Target, TrendingUp, X
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuthUser } from "@/app/auth-provider";
import { db } from "@/lib/firebase";
import { formatCurrency } from "@/lib/money";
import type { Goal, GoalType } from "@/lib/types";

const G = "#b8f55a";

const GOAL_META: Record<GoalType, { label: string; icon: React.ReactNode; color: string }> = {
  reserva:     { label: "Reserva de emergência", icon: <Shield size={16} />,     color: "#60a5fa" },
  viagem:      { label: "Viagem",                icon: <Plane size={16} />,       color: "#f472b6" },
  divida:      { label: "Quitar dívida",         icon: <CreditCard size={16} />,  color: "#fb923c" },
  investimento:{ label: "Investimento",          icon: <TrendingUp size={16} />,  color: G },
  outro:       { label: "Outro",                 icon: <Target size={16} />,      color: "#a78bfa" },
};

function Shell({ text }: { text: string }) {
  return (
    <div style={{ minHeight: "100vh", background: "#09090b", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
      {text}
    </div>
  );
}

export default function MetasPage() {
  const { user, authLoading } = useAuthUser();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [authLoading, user, router]);

  if (authLoading) return <Shell text="Carregando..." />;
  if (!user) return null;

  const workspaceId = typeof window !== "undefined" ? localStorage.getItem("fincheck_workspace") ?? "" : "";
  if (!workspaceId) { router.replace("/"); return null; }

  return (
    <Suspense fallback={<Shell text="Carregando..." />}>
      <MetasView workspaceId={workspaceId} user={user} />
    </Suspense>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthsToComplete(goal: Goal): number | null {
  const remaining = goal.targetAmount - goal.currentAmount;
  if (remaining <= 0) return 0;
  if (!goal.monthlyContribution || goal.monthlyContribution <= 0) return null;
  return Math.ceil(remaining / goal.monthlyContribution);
}

function estimatedDate(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

// ─── Main view ────────────────────────────────────────────────────────────────

function MetasView({ workspaceId, user }: { workspaceId: string; user: User }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefill = {
    tipo:   searchParams.get("tipo") as GoalType | null,
    valor:  searchParams.get("valor"),
    mensal: searchParams.get("mensal"),
    prazo:  searchParams.get("prazo") ? Number(searchParams.get("prazo")) : null,
    titulo: searchParams.get("titulo"),
  };
  const hasPrefill = !!(prefill.tipo || prefill.valor);

  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(hasPrefill);
  const [depositGoal, setDepositGoal] = useState<Goal | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "workspaces", workspaceId, "goals"),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      setGoals(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Goal));
      setLoading(false);
    }, () => setLoading(false));
  }, [workspaceId]);

  const active    = goals.filter((g) => g.status === "active");
  const completed = goals.filter((g) => g.status === "completed");

  const totalTarget  = active.reduce((s, g) => s + g.targetAmount, 0);
  const totalSaved   = active.reduce((s, g) => s + g.currentAmount, 0);
  const overallPct   = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  const S: React.CSSProperties = {
    minHeight: "100vh",
    background: "#09090b",
    color: "#fff",
    fontFamily: "var(--font-dm-sans, sans-serif)",
  };

  const CARD: React.CSSProperties = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 12,
  };

  return (
    <div style={S}>
      {/* Header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(9,9,11,0.92)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={() => router.push("/home")}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 0 }}
          >
            <ArrowLeft size={15} /> Voltar
          </button>
          <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 16 }}>|</span>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Metas financeiras</span>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: G, color: "#000",
            border: "none", borderRadius: 8,
            padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer"
          }}
        >
          <Plus size={14} /> Nova meta
        </button>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 20px" }}>
        {/* Summary cards */}
        {active.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
            {[
              { label: "Metas ativas",    value: String(active.length),       sub: `${completed.length} concluída${completed.length !== 1 ? "s" : ""}` },
              { label: "Total guardado",  value: formatCurrency(totalSaved),  sub: `de ${formatCurrency(totalTarget)}` },
              { label: "Progresso geral", value: `${overallPct}%`,            sub: "do total em metas" },
            ].map(({ label, value, sub }) => (
              <div key={label} style={{ ...CARD, padding: "16px 18px" }}>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.36)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{label}</p>
                <p style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</p>
                <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.36)", marginTop: 4 }}>{sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Active goals */}
        {loading ? (
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, textAlign: "center", padding: "40px 0" }}>Carregando metas...</p>
        ) : active.length === 0 ? (
          <div style={{ ...CARD, padding: "40px 24px", textAlign: "center" }}>
            <Target size={32} style={{ color: "rgba(255,255,255,0.15)", marginBottom: 12 }} />
            <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Nenhuma meta ainda</p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.36)", marginBottom: 20, lineHeight: 1.6 }}>
              Crie sua primeira meta — reserva de emergência,<br />viagem, quitar dívida ou investimento.
            </p>
            <button
              onClick={() => setAddOpen(true)}
              style={{ background: G, color: "#000", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              + Nova meta
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {active.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                workspaceId={workspaceId}
                onDeposit={() => setDepositGoal(goal)}
              />
            ))}
          </div>
        )}

        {/* Completed */}
        {completed.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
              Concluídas ({completed.length})
            </p>
            <div style={{ display: "grid", gap: 10 }}>
              {completed.map((goal) => (
                <GoalCard key={goal.id} goal={goal} workspaceId={workspaceId} onDeposit={() => {}} />
              ))}
            </div>
          </div>
        )}
      </div>

      {addOpen && (
        <AddGoalModal
          workspaceId={workspaceId}
          user={user}
          onClose={() => setAddOpen(false)}
          initialType={prefill.tipo ?? undefined}
          initialTarget={prefill.valor ?? undefined}
          initialMonthly={prefill.mensal ?? undefined}
          initialPrazoMeses={prefill.prazo ?? undefined}
          initialTitle={prefill.titulo ?? undefined}
        />
      )}

      {depositGoal && (
        <DepositModal
          goal={depositGoal}
          workspaceId={workspaceId}
          onClose={() => setDepositGoal(null)}
        />
      )}
    </div>
  );
}

// ─── Goal card ────────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  workspaceId,
  onDeposit,
}: {
  goal: Goal;
  workspaceId: string;
  onDeposit: () => void;
}) {
  const meta    = GOAL_META[goal.type];
  const pct     = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0;
  const months  = monthsToComplete(goal);
  const isDone  = goal.status === "completed" || pct >= 100;

  const handleComplete = async () => {
    await updateDoc(doc(db, "workspaces", workspaceId, "goals", goal.id), {
      status: isDone ? "active" : "completed",
      updatedAt: serverTimestamp(),
    });
  };

  return (
    <div style={{
      background: isDone ? "rgba(184,245,90,0.04)" : "rgba(255,255,255,0.03)",
      border: `1px solid ${isDone ? "rgba(184,245,90,0.18)" : "rgba(255,255,255,0.07)"}`,
      borderRadius: 14,
      padding: "18px 20px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: `${meta.color}18`,
            border: `1px solid ${meta.color}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: meta.color, flexShrink: 0
          }}>
            {meta.icon}
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>{goal.title}</p>
            <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.36)", marginTop: 2 }}>{meta.label}</p>
          </div>
        </div>
        {isDone ? (
          <span style={{ fontSize: 11, fontWeight: 700, color: G, background: "rgba(184,245,90,0.12)", border: "1px solid rgba(184,245,90,0.2)", borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap" }}>
            ✓ Concluída
          </span>
        ) : (
          <button
            onClick={onDeposit}
            style={{
              background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8, color: "#fff", cursor: "pointer",
              fontSize: 12, fontWeight: 700, padding: "6px 12px", whiteSpace: "nowrap"
            }}
          >
            + Depositar
          </button>
        )}
      </div>

      {/* Progress */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em", color: isDone ? G : "#fff" }}>
          {formatCurrency(goal.currentAmount)}
        </span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
          {pct}% de {formatCurrency(goal.targetAmount)}
        </span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: isDone ? G : meta.color,
          borderRadius: 3,
          transition: "width .4s ease"
        }} />
      </div>

      {/* Footer info */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {goal.deadline && (
          <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.36)" }}>
            📅 Prazo: {new Date(goal.deadline + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
          </span>
        )}
        {goal.monthlyContribution && goal.monthlyContribution > 0 && !isDone && months !== null && (
          <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.36)" }}>
            💰 {formatCurrency(goal.monthlyContribution)}/mês → conclusão em {estimatedDate(months)}
          </span>
        )}
        {goal.monthlyContribution && goal.monthlyContribution > 0 && !isDone && months === null && (
          <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.36)" }}>
            💰 {formatCurrency(goal.monthlyContribution)}/mês
          </span>
        )}
        {!isDone && pct >= 100 && (
          <button
            onClick={handleComplete}
            style={{ fontSize: 11.5, color: G, background: "transparent", border: "none", cursor: "pointer", padding: 0, fontWeight: 700 }}
          >
            Marcar como concluída →
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Add goal modal ───────────────────────────────────────────────────────────

function prazoToDeadline(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function AddGoalModal({
  workspaceId,
  user,
  onClose,
  initialType,
  initialTarget,
  initialMonthly,
  initialPrazoMeses,
  initialTitle,
}: {
  workspaceId: string;
  user: User;
  onClose: () => void;
  initialType?: GoalType;
  initialTarget?: string;
  initialMonthly?: string;
  initialPrazoMeses?: number;
  initialTitle?: string;
}) {
  const [title, setTitle] = useState(initialTitle ?? "");
  const [type, setType]   = useState<GoalType>(initialType ?? "reserva");
  const [target, setTarget]       = useState(initialTarget ?? "");
  const [current, setCurrent]     = useState("");
  const [monthly, setMonthly]     = useState(initialMonthly ?? "");
  const [deadline, setDeadline]   = useState(initialPrazoMeses ? prazoToDeadline(initialPrazoMeses) : "");
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState("");

  const displayName =
    user.displayName || user.email?.split("@")[0] || "Usuário";

  const handleSave = async () => {
    if (!title.trim() || !target || Number(target) <= 0) return;
    setSaving(true);
    setSaveError("");
    try {
      await addDoc(collection(db, "workspaces", workspaceId, "goals"), {
        title: title.trim(),
        type,
        targetAmount: Number(target),
        currentAmount: Number(current) || 0,
        monthlyContribution: Number(monthly) || 0,
        deadline: deadline || null,
        status: "active",
        createdBy: user.uid,
        createdByName: displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      onClose();
    } catch {
      setSaveError("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const OVERLAY: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 200, padding: 20,
  };
  const MODAL: React.CSSProperties = {
    background: "#111113", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 16, padding: "24px 24px 20px", width: "100%", maxWidth: 420,
  };
  const LABEL: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6, display: "block",
  };
  const INPUT: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8, color: "#fff", fontSize: 14, padding: "9px 12px",
    outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={OVERLAY} onClick={onClose}>
      <div style={MODAL} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800 }}>Nova meta</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <label style={LABEL}>Tipo</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(Object.keys(GOAL_META) as GoalType[]).map((t) => {
                const m = GOAL_META[t];
                const active = type === t;
                return (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      cursor: "pointer", transition: "all .15s",
                      background: active ? `${m.color}20` : "rgba(255,255,255,0.05)",
                      border: `1px solid ${active ? m.color + "60" : "rgba(255,255,255,0.1)"}`,
                      color: active ? m.color : "rgba(255,255,255,0.5)",
                    }}
                  >
                    {m.icon} {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={LABEL}>Nome da meta</label>
            <input
              style={INPUT} value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={`Ex: ${GOAL_META[type].label}`}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={LABEL}>Valor da meta (R$)</label>
              <input type="number" min="0" step="100" style={INPUT} value={target}
                onChange={(e) => setTarget(e.target.value)} placeholder="50.000" />
            </div>
            <div>
              <label style={LABEL}>Já tenho (R$)</label>
              <input type="number" min="0" step="100" style={INPUT} value={current}
                onChange={(e) => setCurrent(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={LABEL}>Poupo por mês (R$)</label>
              <input type="number" min="0" step="50" style={INPUT} value={monthly}
                onChange={(e) => setMonthly(e.target.value)} placeholder="1.000" />
            </div>
            <div>
              <label style={LABEL}>Prazo (opcional)</label>
              <input type="month" style={INPUT} value={deadline.slice(0, 7)}
                onChange={(e) => setDeadline(e.target.value ? e.target.value + "-01" : "")} />
            </div>
          </div>

          {saveError && (
            <p style={{ fontSize: 12.5, color: "#f87171", textAlign: "center", margin: "0 0 4px" }}>
              {saveError}
            </p>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !title.trim() || !target || Number(target) <= 0}
            style={{
              marginTop: 4, background: G, color: "#000", border: "none",
              borderRadius: 9, padding: "11px", fontSize: 14, fontWeight: 800,
              cursor: saving ? "wait" : "pointer",
              opacity: !title.trim() || !target || Number(target) <= 0 ? 0.4 : 1
            }}
          >
            {saving ? "Salvando..." : "Criar meta"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Deposit modal ────────────────────────────────────────────────────────────

function DepositModal({
  goal,
  workspaceId,
  onClose,
}: {
  goal: Goal;
  workspaceId: string;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const meta = GOAL_META[goal.type];

  const handleDeposit = async () => {
    const v = Number(amount);
    if (!v || v <= 0) return;
    setSaving(true);
    try {
      const newAmount = goal.currentAmount + v;
      const isNowComplete = newAmount >= goal.targetAmount;
      await updateDoc(doc(db, "workspaces", workspaceId, "goals", goal.id), {
        currentAmount: newAmount,
        status: isNowComplete ? "completed" : "active",
        updatedAt: serverTimestamp(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const afterDeposit = Number(amount) > 0 ? goal.currentAmount + Number(amount) : null;
  const pctAfter = afterDeposit !== null
    ? Math.min(100, Math.round((afterDeposit / goal.targetAmount) * 100))
    : null;

  const OVERLAY: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 200, padding: 20,
  };
  const MODAL: React.CSSProperties = {
    background: "#111113", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 16, padding: "24px", width: "100%", maxWidth: 360,
  };

  return (
    <div style={OVERLAY} onClick={onClose}>
      <div style={MODAL} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ color: meta.color }}>{meta.icon}</div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700 }}>{goal.title}</p>
              <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.36)" }}>
                Faltam {formatCurrency(remaining)}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6, display: "block" }}>
            Quanto você depositou? (R$)
          </label>
          <input
            type="number" min="0" step="50" autoFocus
            value={amount} onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleDeposit()}
            placeholder={formatCurrency(remaining).replace("R$ ", "").replace(".", "").replace(",", ".")}
            style={{
              width: "100%", background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8,
              color: "#fff", fontSize: 22, fontWeight: 800, padding: "10px 14px",
              outline: "none", boxSizing: "border-box", letterSpacing: "-0.02em",
            }}
          />
        </div>

        {pctAfter !== null && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>
              <span>{formatCurrency(afterDeposit!)} guardados</span>
              <span>{pctAfter}%</span>
            </div>
            <div style={{ height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pctAfter}%`, background: meta.color, borderRadius: 3, transition: "width .3s" }} />
            </div>
            {pctAfter >= 100 && (
              <p style={{ fontSize: 12, color: G, fontWeight: 700, marginTop: 8 }}>🎉 Meta atingida! Será marcada como concluída.</p>
            )}
          </div>
        )}

        <button
          onClick={handleDeposit}
          disabled={saving || !amount || Number(amount) <= 0}
          style={{
            width: "100%", background: G, color: "#000", border: "none",
            borderRadius: 9, padding: "11px", fontSize: 14, fontWeight: 800,
            cursor: saving ? "wait" : "pointer",
            opacity: !amount || Number(amount) <= 0 ? 0.4 : 1,
          }}
        >
          {saving ? "Salvando..." : "Registrar depósito"}
        </button>
      </div>
    </div>
  );
}
