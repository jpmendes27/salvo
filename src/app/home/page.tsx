"use client";

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User
} from "firebase/auth";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crown,
  Eye,
  EyeOff,
  FileText,
  ImageIcon,
  LogOut,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  Target,
  Trash2,
  TrendingUp,
  Upload,
  Users,
  X
} from "lucide-react";
import { CSSProperties, DragEvent, FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { auth, db, googleProvider, storage } from "@/lib/firebase";
import { ref as storageRef, uploadBytes } from "firebase/storage";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/app/auth-provider";
import { consentText, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { currentMonthKey, formatCurrency, maskBRL, parseBRL, monthLabel } from "@/lib/money";
import { buildMonthlyPlanSummary } from "@/lib/planning";
import { buildMonthlySummary } from "@/lib/summary";
import type { Member, PlannedItem, PlannedItemStatus, RecurringItem, Transaction, TransactionType, Workspace } from "@/lib/types";
import { defaultCategories, demoTransactions } from "@/lib/demo";
import { categorizeTransaction, CATEGORIES, CATEGORY_COLORS, CATEGORY_LABELS, fileToBase64, guessCategory, normalizeSourceLabel, parseCSV, parseOFX, sourceLabelFromFilename, type ParsedTransaction } from "@/lib/parsers";
import { isStopDescription, parseBankText } from "@/lib/bank-parsers";
import { CategoryAvatar } from "@/components/CategoryAvatar";
import { extractPDFText } from "@/lib/pdf-extract";
import { ComposedChart, AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from "recharts";
import { track } from "@/lib/analytics";
import { getUserFacingError } from "@/lib/errors";
import { buildDiagFingerprint, readDiagCache, writeDiagCache, type DiagPayload, type DiagResult } from "@/lib/claude-cache";

type Profile = {
  uid: string;
  displayName: string;
  email: string;
  cpf?: string;
  accountVerified?: boolean;
  hasCreatedRealMonth?: boolean;
  acceptedTermsVersion?: string;
  acceptedPrivacyVersion?: string;
  workspaceIds?: string[];
};

type WorkspaceWithMember = {
  workspace: Workspace;
  member: Member;
};

const G = "#b8f55a";
const G_10 = "rgba(184,245,90,0.10)";
const G_20 = "rgba(184,245,90,0.18)";
const G_30 = "rgba(184,245,90,0.28)";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function HomePage() {
  const { user, authLoading } = useAuthUser();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      window.location.replace(`${BASE}/login`);
    }
  }, [authLoading, user]);

  if (authLoading || !user) return <SalvoLoader />;
  return <AuthenticatedApp user={user} />;
}

function GlassCard({
  children,
  style = {},
  accent = false
}: {
  children: ReactNode;
  style?: CSSProperties;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: 20,
        backdropFilter: "blur(48px) saturate(180%)",
        WebkitBackdropFilter: "blur(48px) saturate(180%)",
        background: "rgba(255,255,255,0.042)",
        boxShadow: accent
          ? `0 0 0 1px rgba(184,245,90,0.28), 0 0 0 1px rgba(255,255,255,0.05) inset,
         0 32px 64px rgba(0,0,0,0.55), 0 0 80px rgba(184,245,90,0.06)`
          : `0 0 0 1px rgba(255,255,255,0.09), 0 0 0 1px rgba(255,255,255,0.04) inset,
         0 24px 48px rgba(0,0,0,0.50)`,
        ...style
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 20,
          pointerEvents: "none",
          zIndex: 0,
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.11) 0%, transparent 45%, rgba(0,0,0,0.08) 100%)"
        }}
      />
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 0 }}>
      <span style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 700, fontSize: "1.15rem", color: "#b8f55a", letterSpacing: "-0.02em", lineHeight: 1 }}>Salvô</span>
      <span style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 700, fontSize: "1.15rem", color: "#ffffff", letterSpacing: "-0.02em", lineHeight: 1 }}>!</span>
      <sup style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.45rem", verticalAlign: "super", color: "#b8f55a", fontWeight: 400, marginLeft: 1 }}>®</sup>
    </div>
  );
}

// AuthScreen moved to /login/page.tsx

const PROFILE_CACHE_KEY = "fincheck_profile_v1";
const WS_CACHE_KEY = "fincheck_workspaces_v1";

function getCachedProfile(uid: string): Profile | null {
  try {
    const raw = sessionStorage.getItem(`${PROFILE_CACHE_KEY}_${uid}`);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch { return null; }
}
function setCachedProfile(uid: string, profile: Profile) {
  try { sessionStorage.setItem(`${PROFILE_CACHE_KEY}_${uid}`, JSON.stringify(profile)); } catch {}
}
function getCachedWorkspaces(uid: string): WorkspaceWithMember[] | null {
  try {
    const raw = sessionStorage.getItem(`${WS_CACHE_KEY}_${uid}`);
    return raw ? (JSON.parse(raw) as WorkspaceWithMember[]) : null;
  } catch { return null; }
}
function setCachedWorkspaces(uid: string, ws: WorkspaceWithMember[]) {
  try { sessionStorage.setItem(`${WS_CACHE_KEY}_${uid}`, JSON.stringify(ws)); } catch {}
}

function AuthenticatedApp({ user }: { user: User }) {
  const cachedProfile = typeof window !== "undefined" ? getCachedProfile(user.uid) : null;
  const cachedWorkspaces = typeof window !== "undefined" ? getCachedWorkspaces(user.uid) : null;
  const [profile, setProfile] = useState<Profile | null>(cachedProfile);
  const [workspaces, setWorkspaces] = useState<WorkspaceWithMember[]>(cachedWorkspaces ?? []);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(
    typeof window !== "undefined" ? (localStorage.getItem("fincheck_workspace") ?? "") : ""
  );
  const [loading, setLoading] = useState(!cachedProfile);
  const [repairingWorkspace, setRepairingWorkspace] = useState(false);
  const [workspaceInaccessible, setWorkspaceInaccessible] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (!snap.exists()) {
        setProfile(null);
        setLoading(false);
        return;
      }
      const profile = snap.data() as Profile;
      if (profile.accountVerified === false) {
        window.location.replace(`${BASE}/verify`); return;
      }
      if (profile.acceptedTermsVersion && !profile.workspaceIds?.length) {
        const displayName = user.displayName || user.email?.split("@")[0] || "Voce";
        await ensureDefaultWorkspace(user, displayName);
        window.location.reload();
        return;
      }
      setCachedProfile(user.uid, profile);

      // Se os workspaceIds do servidor diferem do que está em cache,
      // descarta o cache de workspaces (evita usar workspace stale)
      const cachedWs = getCachedWorkspaces(user.uid);
      const cachedIds = new Set(cachedWs?.map((e) => e.workspace.id) ?? []);
      const freshIds  = new Set(profile.workspaceIds ?? []);
      const sameIds   = cachedIds.size === freshIds.size && [...freshIds].every((id) => cachedIds.has(id));
      if (!sameIds) {
        try { sessionStorage.removeItem(`${WS_CACHE_KEY}_${user.uid}`); } catch {}
        setWorkspaces([]);
        setActiveWorkspaceId("");
      }

      setProfile(profile);
      setLoading(false);
    }
    loadProfile().catch((err) => {
      setError(getUserFacingError(err, "data"));
      setLoading(false);
    });
  }, [user.uid]);

  useEffect(() => {
    const ids = profile?.workspaceIds;
    if (!profile?.acceptedTermsVersion || !ids?.length) return;

    const unsubs = ids.map((wsId) =>
      onSnapshot(
        doc(db, "workspaces", wsId, "members", user.uid),
        (memberSnap) => {
          if (!memberSnap.exists()) return;
          const member = { id: memberSnap.id, workspaceId: wsId, ...memberSnap.data() } as Member;
          if (member.status !== "active") return;

          // Keep memberEmails in sync so Google account re-linking works later.
          if (user.email) {
            updateDoc(doc(db, "workspaces", wsId), { memberEmails: arrayUnion(user.email) }).catch(() => {});
          }

          getDoc(doc(db, "workspaces", wsId))
            .then((wsSnap) => {
              if (!wsSnap.exists()) return;
              const entry: WorkspaceWithMember = {
                workspace: { id: wsSnap.id, ...wsSnap.data() } as Workspace,
                member
              };
              setWorkspaces((prev) => {
                const next = [...prev.filter((e) => e.workspace.id !== wsId), entry];
                setCachedWorkspaces(user.uid, next);
                return next;
              });
              setActiveWorkspaceId((current) => current || wsId);
            })
            .catch((err) => {
              if (isPermissionDenied(err)) {
                setWorkspaceInaccessible(true);
              } else {
                setError(getUserFacingError(err, "data"));
              }
            });
        },
        (err) => {
          if (isPermissionDenied(err)) {
            setWorkspaceInaccessible(true);
          } else {
            setError(getUserFacingError(err, "data"));
          }
        }
      )
    );

    return () => unsubs.forEach((u) => u());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.workspaceIds?.join(","), profile?.acceptedTermsVersion, user.uid]);

  useEffect(() => {
    if (!profile?.acceptedTermsVersion || !profile.workspaceIds?.length || loading || workspaces.length || repairingWorkspace) return;
    const timer = window.setTimeout(() => {
      // workspaceIds exist but no workspace loaded — do NOT auto-create a workspace.
      // This happens when a Google-linked account still needs its member doc created
      // (requires the original account to log in first to populate memberEmails).
      setWorkspaceInaccessible(true);
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [loading, profile, repairingWorkspace, user, workspaces.length]);

  useEffect(() => {
    if (!workspaces.length) return;
    const params = new URLSearchParams(window.location.search);
    const wsParam = params.get("workspace");
    if (wsParam && workspaces.some((e) => e.workspace.id === wsParam)) {
      setActiveWorkspaceId(wsParam);
      const url = new URL(window.location.href);
      url.searchParams.delete("workspace");
      window.history.replaceState({}, "", url.toString());
    }
  }, [workspaces]);

  async function acceptLegal() {
    setError("");
    try {
      const displayName =
        user.displayName ||
        window.localStorage.getItem("fincheck:pendingName") ||
        user.email?.split("@")[0] ||
        "Voce";

      const userRef = doc(db, "users", user.uid);
      const nextProfile: Profile = {
        uid: user.uid,
        displayName,
        email: user.email || "",
        hasCreatedRealMonth: false,
        acceptedTermsVersion: TERMS_VERSION,
        acceptedPrivacyVersion: PRIVACY_VERSION
      };

      await setDoc(userRef, { ...nextProfile, updatedAt: serverTimestamp() }, { merge: true });
      await addDoc(collection(db, "consents"), {
        uid: user.uid,
        email: user.email || "",
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
        text: consentText,
        purpose: "account_and_workspace_access",
        createdAt: serverTimestamp()
      });

      window.localStorage.removeItem("fincheck:pendingName");
      await ensureDefaultWorkspace(user, displayName);
      window.location.reload();
    } catch (err) {
      setError(getUserFacingError(err, "data"));
    }
  }

  if (loading) {
    return <CenteredStatus text="Abrindo sua vida financeira..." />;
  }

  if (error) {
    return (
      <CenteredCard>
        <div className="error">{error}</div>
        <button className="btn secondary" onClick={() => signOut(auth)}>
          Sair
        </button>
      </CenteredCard>
    );
  }

  if (!profile?.acceptedTermsVersion) {
    window.location.replace(`${BASE}/onboarding`);
    return <SalvoLoader />;
  }

  if (!workspaces.length) {
    if (workspaceInaccessible) {
      return (
        <div style={{ minHeight: "100vh", background: "#050505", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, gap: 16, textAlign: "center" }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Workspace inacessível</p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", maxWidth: 320, lineHeight: 1.6 }}>
            Não foi possível carregar seu workspace com este login do Google.<br /><br />
            <strong style={{ color: "rgba(255,255,255,0.7)" }}>Entre uma vez pelo email e senha</strong> para sincronizar sua conta Google com o workspace, depois volte e entre com Google.
          </p>
          <button
            onClick={() => { signOut(auth); window.location.replace(`${BASE}/login`); }}
            style={{ marginTop: 8, padding: "10px 24px", borderRadius: 10, background: "#b8f55a", border: "none", color: "#050505", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            Sair e tentar de novo
          </button>
        </div>
      );
    }
    return (
      <CenteredStatus text="Carregando workspace..." />
    );
  }

  const activeEntry =
    workspaces.find((entry) => entry.workspace.id === activeWorkspaceId) || workspaces[0];

  return (
    <WorkspaceApp
      user={user}
      profile={profile}
      setProfile={setProfile}
      workspaces={workspaces}
      activeEntry={activeEntry}
      onSelectWorkspace={setActiveWorkspaceId}
      onRenameWorkspace={(id, name) =>
        setWorkspaces((prev) =>
          prev.map((e) =>
            e.workspace.id === id ? { ...e, workspace: { ...e.workspace, name } } : e
          )
        )
      }
    />
  );
}

function LegalGate({ onAccept }: { onAccept: () => Promise<void> }) {
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    await onAccept();
    setBusy(false);
  }

  return (
    <CenteredCard>
      <h1>Antes de abrir seu workspace</h1>
      <p className="muted">
        O Salvô! guarda apenas os dados necessarios para sua gestao financeira. Se voce
        convidar alguem, essa pessoa vera os dados do workspace compartilhado.
      </p>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
        />
        <span>
          Li e aceito os <a href="/termos">Termos de Uso</a> e a{" "}
          <a href="/privacidade">Politica de Privacidade</a>.
        </span>
      </label>
      <button className="btn" disabled={!accepted || busy} onClick={submit}>
        Continuar
      </button>
    </CenteredCard>
  );
}

// ─── Workspace dashboard ────────────────────────────────────────────────────

const PARSE_FUNCTION_URL =
  process.env.NEXT_PUBLIC_FUNCTIONS_URL ||
  "https://parsebankstatement-ihalwtxjpq-uc.a.run.app";


const SEND_EMAIL_FUNCTION_URL =
  process.env.NEXT_PUBLIC_SEND_EMAIL_URL ||
  "https://sendinviteemail-ihalwtxjpq-uc.a.run.app";

const SEND_WA_FUNCTION_URL =
  process.env.NEXT_PUBLIC_SEND_WA_URL ||
  "https://sendinvitewhatsapp-ihalwtxjpq-uc.a.run.app";

const GENERATE_DIAGNOSIS_URL =
  process.env.NEXT_PUBLIC_GENERATE_DIAGNOSIS_URL ||
  "https://generatediagnosis-ihalwtxjpq-uc.a.run.app";

type ParsedWithMeta = ParsedTransaction & { _id: string; selected: boolean };

type ImportState =
  | { phase: "parsing" }
  | { phase: "background"; jobId: string; filename: string }
  | { phase: "preview"; rows: ParsedWithMeta[]; error?: string }
  | { phase: "saving"; rows: ParsedWithMeta[] };

function inferSource(sourceLabel?: string): "account" | "card" | undefined {
  if (!sourceLabel) return undefined;
  if (/cartão|fatura|card/i.test(sourceLabel)) return "card";
  return "account";
}

function categoryColor(cat: string): string {
  return CATEGORY_COLORS[cat as keyof typeof CATEGORY_COLORS] ?? "#6b7080";
}

function WorkspaceApp({
  user,
  profile,
  setProfile,
  workspaces,
  activeEntry,
  onSelectWorkspace,
  onRenameWorkspace
}: {
  user: User;
  profile: Profile;
  setProfile: (profile: Profile) => void;
  workspaces: WorkspaceWithMember[];
  activeEntry: WorkspaceWithMember;
  onSelectWorkspace: (workspaceId: string) => void;
  onRenameWorkspace: (id: string, name: string) => void;
}) {
  const router = useRouter();
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [plannedItems, setPlannedItems] = useState<PlannedItem[]>([]);
  const [recurringItems, setRecurringItems] = useState<RecurringItem[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [error, setError] = useState("");
  const [txFilter, setTxFilter] = useState<"all" | "income" | "expense">("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [importState, setImportState] = useState<ImportState | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [inviteModal, setInviteModal] = useState<"whatsapp" | "email" | null>(null);
  const [wsMembers, setWsMembers] = useState<Member[]>([]);
  const [view, setView] = useState<"lancamentos" | "diagnostico">("diagnostico");
  const [reconcilePrompt, setReconcilePrompt] = useState<
    { sourceLabel: string; monthKey: string; amount: number; include: boolean }[]
  >([]);
  const [editingRendaMob, setEditingRendaMob] = useState(false);
  const [rendaMobText, setRendaMobText] = useState("");
  const [emBrevePos, setEmBrevePos] = useState<{ bottom: number; centerX: number } | null>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [renameWsOpen, setRenameWsOpen] = useState(false);
  const [renameWsValue, setRenameWsValue] = useState("");
  const [editRecurringItem, setEditRecurringItem] = useState<RecurringItem | null>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!avatarOpen) return;
    const handler = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [avatarOpen]);

  const workspace = activeEntry.workspace;
  const member = activeEntry.member;
  const isOwner = member.role === "owner";

  const [monthlyIncome, setMonthlyIncome] = useState<number>(workspace.monthlyIncome ?? 0);

  useEffect(() => {
    setMonthlyIncome(workspace.monthlyIncome ?? 0);
  }, [workspace.monthlyIncome]);

  const handleRendaChange = async (v: number) => {
    setMonthlyIncome(v);
    await updateDoc(doc(db, "workspaces", workspace.id), { monthlyIncome: v });
  };

  const showDemo = false;
  const visibleTx = showDemo ? demoTransactions : transactions;
  const sources = useMemo(() => {
    const labels = [...new Set(transactions.map((t) => t.sourceLabel).filter(Boolean))] as string[];
    return labels.sort();
  }, [transactions]);

  const filteredTx = visibleTx.filter((t) => {
    const typeOk = txFilter === "all" || t.type === txFilter;
    const sourceOk = sourceFilter === "all" || t.sourceLabel === sourceFilter;
    return typeOk && sourceOk;
  });
  const summary = useMemo(
    () => buildMonthlySummary(visibleTx, showDemo ? "2026-04" : monthKey),
    [monthKey, showDemo, visibleTx]
  );
  const planSummary = useMemo(
    () => buildMonthlyPlanSummary(showDemo ? demoTransactions : transactions, showDemo ? [] : plannedItems),
    [plannedItems, showDemo, transactions]
  );

  const prevMonthKey = useMemo(() => {
    const [y, m] = monthKey.split("-").map(Number);
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  }, [monthKey]);

  const [prevTransactions, setPrevTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    let attempt = 0;
    let cancelled = false;
    let unsub: (() => void) | null = null;

    function subscribe() {
      setTxLoading(true);
      const txQuery = query(
        collection(db, "workspaces", workspace.id, "transactions"),
        where("monthKey", "==", monthKey),
        orderBy("date", "desc")
      );
      unsub = onSnapshot(
        txQuery,
        (snap) => {
          if (cancelled) return;
          setTransactions(snap.docs.map((d) => {
            const data = d.data();
            const src = (data.source === "account" || data.source === "card")
              ? data.source
              : inferSource(data.sourceLabel as string | undefined);
            return { id: d.id, ...data, source: src } as Transaction;
          }));
          setTxLoading(false);
        },
        (err) => {
          if (cancelled) return;
          const code = (err as { code?: string }).code;
          if (code === "permission-denied" && attempt < 3) {
            attempt++;
            setTimeout(() => { if (!cancelled) subscribe(); }, 300 * attempt);
            return;
          }
          if (code !== "permission-denied") setError(getUserFacingError(err, "data"));
          setTxLoading(false);
        }
      );
    }

    subscribe();
    return () => { cancelled = true; unsub?.(); };
  }, [workspace.id, monthKey]);

  useEffect(() => {
    const q = query(
      collection(db, "workspaces", workspace.id, "transactions"),
      where("monthKey", "==", prevMonthKey)
    );
    return onSnapshot(q,
      (snap) => setPrevTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Transaction)),
      () => {}
    );
  }, [workspace.id, prevMonthKey]);

  useEffect(() => {
    if (showDemo) {
      setPlannedItems([]);
      return;
    }
    const planQuery = query(
      collection(db, "workspaces", workspace.id, "plannedItems"),
      where("monthKey", "==", monthKey)
    );
    return onSnapshot(
      planQuery,
      (snap) => {
        const items = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as PlannedItem)
          .sort((a, b) => a.dueDay - b.dueDay || a.title.localeCompare(b.title));
        setPlannedItems(items);
      },
      (err) => { if ((err as { code?: string }).code !== "permission-denied") setError(getUserFacingError(err, "data")); }
    );
  }, [monthKey, showDemo, workspace.id]);

  // Load all active recurring items (not month-scoped)
  useEffect(() => {
    if (showDemo) {
      setRecurringItems([]);
      return;
    }
    const q = query(
      collection(db, "workspaces", workspace.id, "recurringItems"),
      where("active", "==", true)
    );
    return onSnapshot(
      q,
      (snap) => setRecurringItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RecurringItem)),
      (err) => { if ((err as { code?: string }).code !== "permission-denied") setError(getUserFacingError(err, "data")); }
    );
  }, [showDemo, workspace.id]);

  // Keep a ref so the auto-generation effect reads latest plannedItems without re-triggering itself
  const plannedItemsRef = useRef<PlannedItem[]>([]);
  useEffect(() => { plannedItemsRef.current = plannedItems; }, [plannedItems]);

  // Auto-generate plannedItems for current month from active recurring items (idempotent)
  useEffect(() => {
    if (!recurringItems.length) return;
    const existingRecurringIds = new Set(
      plannedItemsRef.current.filter((p) => p.recurringId).map((p) => p.recurringId!)
    );
    const toCreate = recurringItems.filter((r) => {
      if (existingRecurringIds.has(r.id)) return false;
      if (r.recorrencia?.tipo === "parcelada") {
        const { mesInicio, totalMeses } = r.recorrencia;
        if (!mesInicio || !totalMeses) return false;
        const parcelaAtual = calcMonthDiff(mesInicio, monthKey) + 1;
        if (parcelaAtual < 1 || parcelaAtual > totalMeses) return false;
      }
      return true;
    });
    if (!toCreate.length) return;

    const batch = writeBatch(db);
    for (const r of toCreate) {
      const docRef = doc(db, "workspaces", workspace.id, "plannedItems", `${r.id}_${monthKey}`);
      const extra: Record<string, unknown> = {};
      if (r.recorrencia?.tipo === "parcelada" && r.recorrencia.mesInicio && r.recorrencia.totalMeses) {
        extra.parcelaAtual = calcMonthDiff(r.recorrencia.mesInicio, monthKey) + 1;
        extra.totalParcelas = r.recorrencia.totalMeses;
      }
      batch.set(docRef, {
        type: r.type,
        title: r.title,
        amount: r.amount,
        category: r.category,
        dueDay: r.dueDay,
        monthKey,
        status: "planned",
        createdBy: r.createdBy,
        createdByName: r.createdByName,
        recurringId: r.id,
        ...extra,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    batch.commit().catch(console.error);
  }, [recurringItems, monthKey, workspace.id]);

  async function markReal() {
    if (profile.hasCreatedRealMonth) return;
    await updateDoc(doc(db, "users", user.uid), {
      hasCreatedRealMonth: true,
      updatedAt: serverTimestamp()
    });
    setProfile({ ...profile, hasCreatedRealMonth: true });
  }

  // Uploads file to Storage, creates the importJob doc, and transitions to
  // the background polling phase. Called when local parsers return < 3 rows
  // or when pdfjs fails (e.g. OOM on mobile).
  async function startBackgroundJob(
    file: File,
    mode: "text" | "pdf",
    textContent: string | null
  ) {
    const jobId = crypto.randomUUID();
    await setDoc(doc(db, "workspaces", workspace.id, "importJobs", jobId), {
      status: "processing",
      filename: file.name,
      createdAt: serverTimestamp(),
      uid: user.uid,
    });

    const storagePath =
      mode === "text"
        ? `imports/${workspace.id}/${jobId}/text.txt`
        : `imports/${workspace.id}/${jobId}/raw.pdf`;

    const uploadRef = storageRef(storage, storagePath);

    if (mode === "text" && textContent !== null) {
      await uploadBytes(uploadRef, new Blob([textContent], { type: "text/plain" }), {
        contentType: "text/plain",
        customMetadata: { originalFilename: file.name },
      });
    } else {
      await uploadBytes(uploadRef, file, {
        contentType: "application/pdf",
        customMetadata: { originalFilename: file.name },
      });
    }

    setImportState({ phase: "background", jobId, filename: file.name });
  }

  // Stable ID for the current background job — drives the polling effect below.
  const bgJobId =
    importState?.phase === "background" ? importState.jobId : null;

  useEffect(() => {
    if (!bgJobId) return;

    const unsub = onSnapshot(
      doc(db, "workspaces", workspace.id, "importJobs", bgJobId),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as {
          status: string;
          transactions?: ParsedTransaction[];
          warning?: string;
          error?: string;
        };

        if (data.status === "done" || data.status === "partial") {
          const existingKeys = new Set(
            transactions.map((t) => {
              const raw = (t as Transaction & { dedupKey?: string }).dedupKey;
              return raw ?? `${t.date}|${t.description.toLowerCase().trim()}|${t.amount.toFixed(2)}`;
            })
          );
          const rows: ParsedWithMeta[] = (data.transactions ?? []).map(
            (t: ParsedTransaction) => ({
              ...t,
              source: inferSource(t.sourceLabel),
              _id: crypto.randomUUID(),
              selected: !existingKeys.has(
                `${t.date}|${(t.description ?? "").toLowerCase().trim()}|${Math.abs(t.amount ?? 0).toFixed(2)}`
              ),
            })
          );
          setImportState({
            phase: "preview",
            rows,
            error: data.status === "partial" ? data.warning : undefined,
          });
          unsub();
        } else if (data.status === "failed") {
          setImportState({
            phase: "preview",
            rows: [],
            error: data.error ?? "Erro ao processar o arquivo. Tenta de novo.",
          });
          unsub();
        }
      },
      () => {
        setImportState({
          phase: "preview",
          rows: [],
          error: "Não consegui acompanhar o processamento. Tenta de novo.",
        });
      }
    );

    return () => unsub();
  }, [bgJobId, workspace.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFiles(files: File[]) {
    setImportState({ phase: "parsing" });
    const ext = files[0]?.name.split(".").pop()?.toLowerCase() ?? "unknown";
    track("extrato_import_started", { file_type: ext, file_count: files.length });
    const rows: ParsedWithMeta[] = [];

    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const mime = file.type || `application/${ext}`;
      try {
        if (ext === "csv" || mime.includes("csv")) {
          const text = await file.text();
          let csvTxs: ParsedTransaction[] = [];
          try { csvTxs = parseCSV(text, file.name); } catch { /* fallback pra IA */ }
          if (csvTxs.length >= 3) {
            csvTxs.forEach((t) => rows.push({ ...t, source: inferSource(t.sourceLabel), _id: crypto.randomUUID(), selected: true }));
          } else {
            const resp = await fetch(PARSE_FUNCTION_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ textData: text, mimeType: "text/csv", filename: file.name })
            });
            if (!resp.ok) {
              throw new Error(await resp.text().catch(() => resp.statusText));
            }
            const data = await resp.json();
            const csvLabel: string = normalizeSourceLabel(data.sourceLabel || sourceLabelFromFilename(file.name));
            (data.transactions ?? []).forEach((t: ParsedTransaction) => {
              if (Math.abs(t.amount ?? 0) === 0) return;
              if (isStopDescription(t.description ?? "")) return;
              const type = t.type ?? (t.amount < 0 ? "expense" : "income");
              rows.push({
                ...t, type,
                amount: Math.abs(t.amount ?? 0),
                category: categorizeTransaction(t.description ?? "", type),
                sourceLabel: csvLabel,
                source: inferSource(csvLabel),
                _id: crypto.randomUUID(),
                selected: true
              });
            });
          }
        } else if (ext === "ofx" || ext === "qfx" || mime.includes("ofx")) {
          const text = await file.text();
          parseOFX(text, file.name).forEach((t) =>
            rows.push({ ...t, source: inferSource(t.sourceLabel), _id: crypto.randomUUID(), selected: true })
          );
        } else if (ext === "pdf" || mime === "application/pdf" || (mime === "application/octet-stream" && ext === "pdf")) {
          const pdfCandidates = profile.cpf
            ? [
                profile.cpf.slice(0, 3),
                profile.cpf.slice(0, 4),
                profile.cpf.slice(0, 6),
                profile.cpf,
              ]
            : [];

          // Try client-side pdfjs first; on mobile it may throw out-of-memory
          let pdfText: string | null = null;
          try {
            pdfText = await extractPDFText(file, undefined, pdfCandidates);
          } catch {
            // pdfjs failed — will fall back to Cloud Function with raw PDF below
          }

          if (pdfText !== null) {
            const { transactions: bankTxs, sourceLabel: bankLabel } = parseBankText(pdfText, { filename: file.name });

            if (bankTxs.length >= 3) {
              bankTxs.forEach((t) =>
                rows.push({ ...t, source: inferSource(t.sourceLabel), _id: crypto.randomUUID(), selected: true })
              );
            } else {
              // Parsers returned < 3 transactions — hand off to background job
              await startBackgroundJob(file, "text", pdfText);
              return;
            }
          } else {
            // pdfjs failed (e.g. OOM on mobile) — upload raw PDF to background job
            await startBackgroundJob(file, "pdf", null);
            return;
          }
        } else if (mime.startsWith("image/")) {
          const base64 = await fileToBase64(file);
          const resp = await fetch(PARSE_FUNCTION_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileData: base64, mimeType: mime })
          });
          if (!resp.ok) {
            throw new Error(await resp.text().catch(() => resp.statusText));
          }
          const data = await resp.json();
          const imageLabel: string = normalizeSourceLabel(data.sourceLabel || "Comprovante");
          (data.transactions ?? []).forEach((t: ParsedTransaction) => {
            if (Math.abs(t.amount ?? 0) === 0) return;
            if (isStopDescription(t.description ?? "")) return;
            const type = t.type ?? (t.amount < 0 ? "expense" : "income");
            rows.push({
              ...t,
              type,
              amount: Math.abs(t.amount ?? 0),
              category: categorizeTransaction(t.description ?? "", type),
              sourceLabel: imageLabel,
              source: inferSource(imageLabel),
              _id: crypto.randomUUID(),
              selected: true
            });
          });
        }
      } catch (err) {
        track("extrato_import_error", { stage: "parse", file_type: ext });
        setImportState({
          phase: "preview",
          rows,
          error: getUserFacingError(err, "import")
        });
        return;
      }
    }

    // Auto-deselect duplicates
    const existingKeys = new Set(
      transactions.map((t) => {
        const raw = (t as Transaction & { dedupKey?: string }).dedupKey;
        if (raw) return raw;
        return `${t.date}|${t.description.toLowerCase().trim()}|${t.amount.toFixed(2)}`;
      })
    );
    rows.forEach((r) => {
      if (existingKeys.has(r.dedupKey)) r.selected = false;
    });

    setImportState({ phase: "preview", rows });
  }

  async function confirmImport(rows: ParsedWithMeta[]) {
    setImportState({ phase: "saving", rows });
    try {
      const selected = rows.filter((r) => r.selected);
      for (const tx of selected) {
        await addDoc(collection(db, "workspaces", workspace.id, "transactions"), {
          type: tx.type,
          description: tx.description,
          amount: tx.amount,
          category: tx.category || categorizeTransaction(tx.description, tx.type),
          date: tx.date,
          monthKey: tx.monthKey || tx.date.slice(0, 7),
          createdBy: user.uid,
          createdByName: profile.displayName,
          sourceLabel: tx.sourceLabel ?? null,
          dedupKey: tx.dedupKey || `${tx.date}|${tx.description.toLowerCase().trim()}|${tx.amount.toFixed(2)}`,
          source: tx.source ?? null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      await markReal();
      track("extrato_import_success", { tx_count: selected.length });
      setImportState(null);

    // Reconciliação: detecta faturas de cartão e propõe adicionar ao Plano do mês
    const isCard = (label: string) => label.includes("••••") || /cartão|fatura/i.test(label);
    const totals: Record<string, { sourceLabel: string; monthKey: string; amount: number }> = {};
    for (const tx of selected) {
      const label = tx.sourceLabel ?? "";
      if (!isCard(label) || tx.type !== "expense") continue;
      const mk = tx.monthKey || tx.date.slice(0, 7);
      const key = `${label}|${mk}`;
      if (!totals[key]) totals[key] = { sourceLabel: label, monthKey: mk, amount: 0 };
      totals[key].amount += tx.amount;
    }
    const suggestions = Object.values(totals);
    if (suggestions.length > 0) {
      setReconcilePrompt(suggestions.map((s) => ({ ...s, include: true })));
    }
    } catch (err) {
      track("extrato_import_error", { stage: "save" });
      setImportState({ phase: "preview", rows });
      setError(getUserFacingError(err, "import"));
    }
  }

  async function updatePlannedStatus(item: PlannedItem, status: PlannedItemStatus) {
    await updateDoc(doc(db, "workspaces", workspace.id, "plannedItems", item.id), {
      status,
      updatedAt: serverTimestamp()
    });
  }

  useEffect(() => {
    getDocs(collection(db, "workspaces", workspace.id, "members")).then((snap) => {
      setWsMembers(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Member))
          .filter((m) => m.status === "active")
          .sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : 0))
      );
    });
  }, [workspace.id]);

  async function createInvite() {
    setError("");
    try {
      const token = crypto.randomUUID();
      const createdByName = profile.displayName || user.displayName || user.email?.split("@")[0] || "Alguém";
      await setDoc(doc(db, "invites", token), {
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        createdBy: user.uid,
        createdByName,
        status: "active",
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000))
      });
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      setInviteLink(`${window.location.origin}${basePath}/convite?token=${token}`);
    } catch (err) {
      setError(getUserFacingError(err, "data"));
    }
  }

  async function deleteWorkspace() {
    const conf = window.prompt(
      `Digite "${workspace.name}" para confirmar a exclusão permanente.`
    );
    if (conf !== workspace.name) return;
    const batch = writeBatch(db);
    for (const col of ["transactions", "categories", "summaries", "plannedItems", "openFinanceWaitlist"]) {
      const snap = await getDocs(collection(db, "workspaces", workspace.id, col));
      snap.docs.forEach((d) => batch.delete(d.ref));
    }
    batch.delete(doc(db, "workspaces", workspace.id));
    await batch.commit();
    const membersSnap = await getDocs(
      collection(db, "workspaces", workspace.id, "members")
    );
    for (const md of membersSnap.docs) await deleteDoc(md.ref);
  }

  // Mobile insights computations
  const mobExpenses = useMemo(() => visibleTx.filter(t => t.type === "expense"), [visibleTx]);
  const mobTotalGasto = useMemo(() => mobExpenses.reduce((s, t) => s + t.amount, 0), [mobExpenses]);
  const mobTotalEntradas = useMemo(() => visibleTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0), [visibleTx]);
  const mobDaysWithExpenses = useMemo(() => new Set(mobExpenses.map(t => t.date)).size, [mobExpenses]);
  const mobMediaDia = mobDaysWithExpenses > 0 ? mobTotalGasto / mobDaysWithExpenses : 0;
  const mobRendaRef = monthlyIncome > 0 ? monthlyIncome : (mobTotalEntradas > 0 ? mobTotalEntradas : 1);
  const mobComprometimento = mobTotalGasto > 0 ? Math.min(100, Math.round((mobTotalGasto / mobRendaRef) * 100)) : 0;
  const mobRatio = mobTotalGasto / mobRendaRef;
  const mobScore: number | null = mobExpenses.length === 0 ? null : (() => {
    if (mobRatio >= 2.0) return 0;
    if (mobRatio >= 1.5) return 1;
    if (mobRatio >= 1.0) return 2.5;
    if (mobRatio >= 0.90) return 4.5;
    if (mobRatio >= 0.75) return 6.5;
    if (mobRatio >= 0.50) return 8.5;
    return 10;
  })();
  const mobByCategory = useMemo(() => {
    const m: Record<string, number> = {};
    for (const tx of mobExpenses) m[tx.category] = (m[tx.category] ?? 0) + tx.amount;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [mobExpenses]);
  const mobMaxCategory = mobByCategory[0]?.[1] ?? 1;
  const mobPrevByCategory = useMemo(() => {
    const m: Record<string, number> = {};
    for (const tx of prevTransactions.filter(t => t.type === "expense")) m[tx.category] = (m[tx.category] ?? 0) + tx.amount;
    return m;
  }, [prevTransactions]);
  const mobSubscriptions = useMemo(() => {
    const subs = visibleTx.filter(t => t.category === "Assinaturas");
    const byDesc: Record<string, number> = {};
    for (const tx of subs) byDesc[tx.description] = (byDesc[tx.description] ?? 0) + tx.amount;
    return Object.entries(byDesc).sort((a, b) => b[1] - a[1]);
  }, [visibleTx]);
  const mobRecentTx = useMemo(() => [...visibleTx].slice(0, 6), [visibleTx]);
  const mobPrevExpense = useMemo(() => prevTransactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0), [prevTransactions]);
  const mobPrevIncome = useMemo(() => prevTransactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0), [prevTransactions]);
  const mobIncomeChange = mobPrevIncome > 0 && summary.income > 0 ? Math.round(((summary.income - mobPrevIncome) / mobPrevIncome) * 100) : null;
  const prevSavingsRate = mobPrevIncome > 0 ? Math.round(((mobPrevIncome - mobPrevExpense) / mobPrevIncome) * 100) : null;
  const mobSavingsChange = prevSavingsRate !== null && summary.savingsRate !== null ? summary.savingsRate - prevSavingsRate : null;
  const mobByDay = useMemo(() => {
    const m: Record<string, number> = {};
    for (const tx of mobExpenses) m[tx.date] = (m[tx.date] ?? 0) + tx.amount;
    return m;
  }, [mobExpenses]);
  const mobPrevByDay = useMemo(() => {
    const m: Record<string, number> = {};
    for (const tx of prevTransactions.filter(t => t.type === "expense")) m[tx.date] = (m[tx.date] ?? 0) + tx.amount;
    return m;
  }, [prevTransactions]);

  // Diagnosis state — shared between mobile view and InsightsView (desktop)
  const [sharedAiDiag, setSharedAiDiag] = useState<DiagResult | null>(null);
  const [sharedDiagLoading, setSharedDiagLoading] = useState(false);
  const [sharedDiagError, setSharedDiagError] = useState(false);
  const mobScoreColor = mobScore === null ? G : mobScore >= 8 ? G : mobScore >= 6 ? "#facc15" : "#ff8080";
  const mobScoreRgb = mobScoreColor === G ? "184,245,90" : mobScoreColor === "#facc15" ? "250,204,21" : "255,128,128";
  const mobScoreLabel = mobScore === null ? "—" : mobScore >= 8 ? "Arrasando 💪" : mobScore >= 6 ? "Dá pra melhorar" : "Tá pesado.";
  const mobNet = mobTotalEntradas - mobTotalGasto;
  const mobTopCat = mobByCategory[0] ?? null;
  const mobExpenseChange = mobPrevExpense > 0 && summary.expense > 0 ? Math.round(((summary.expense - mobPrevExpense) / mobPrevExpense) * 100) : null;
  const mobNarrativa = (mobScore ?? 0) >= 8
    ? `Fechou o mês no positivo em ${formatCurrency(mobNet)}. Só ${mobComprometimento}% da renda foi embora — isso é disciplina de verdade.`
    : (mobScore ?? 0) >= 6
    ? `Mês fechou ${mobNet >= 0 ? "positivo" : "no vermelho"} em ${formatCurrency(Math.abs(mobNet))}, mas ${mobComprometimento}% da renda já era. Dá pra apertar mais.`
    : `${mobComprometimento}% da renda foi embora esse mês. Sobrou ${formatCurrency(Math.abs(mobNet))}${mobNet < 0 ? " no negativo" : ""} — isso precisa mudar.`;
  const mobBullet1 = mobTopCat ? `${mobTopCat[0]} engoliu ${formatCurrency(mobTopCat[1])} — ${Math.round((mobTopCat[1] / mobTotalGasto) * 100)}% de tudo que saiu` : null;
  const mobBullet2 = mobExpenseChange !== null
    ? mobExpenseChange > 100
      ? `Gastos explodiram ${Math.abs(mobExpenseChange)}% vs mês passado — o que mudou?`
      : mobExpenseChange > 0
      ? `Gastos ${Math.abs(mobExpenseChange)}% maiores que o mês passado`
      : `Você cortou ${Math.abs(mobExpenseChange)}% dos gastos vs mês passado — continua assim`
    : null;

  useEffect(() => {
    if (!mobExpenses.length || mobScore === null) return;
    const effectiveMonthKey = showDemo ? "2026-04" : monthKey;
    const payload: DiagPayload = {
      totalGasto: mobTotalGasto,
      totalEntradas: mobTotalEntradas,
      comprometimento: mobComprometimento,
      net: mobNet,
      score: mobScore,
      topCat: mobTopCat ? {
        nome: CATEGORY_LABELS[mobTopCat[0] as keyof typeof CATEGORY_LABELS] ?? mobTopCat[0],
        valor: mobTopCat[1],
        percentual: Math.round((mobTopCat[1] / mobTotalGasto) * 100)
      } : null,
      expenseChange: mobExpenseChange,
      byCategory: mobByCategory.slice(0, 5).map(([cat, val]) => ({
        nome: CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat,
        valor: val
      })),
    };
    const fp = buildDiagFingerprint(payload);
    const cached = readDiagCache(workspace.id, effectiveMonthKey, fp);
    if (cached) {
      setSharedAiDiag(cached);
      setSharedDiagLoading(false);
      return;
    }
    let cancelled = false;
    setSharedDiagLoading(true);
    setSharedAiDiag(null);
    setSharedDiagError(false);
    fetch(GENERATE_DIAGNOSIS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, monthLabel: monthLabel(effectiveMonthKey) })
    })
      .then(async (r) => {
        if (!r.ok) { const t = await r.text().catch(() => r.statusText); throw new Error(t); }
        return r.json();
      })
      .then((data: DiagResult) => {
        if (!cancelled) {
          setSharedAiDiag(data);
          writeDiagCache(workspace.id, effectiveMonthKey, fp, data);
        }
      })
      .catch((err) => {
        // Graceful degradation: log technical error, show soft state in UI — home stays usable
        getUserFacingError(err, "diagnosis"); // triggers console.error + admin alert if operational
        if (!cancelled) setSharedDiagError(true);
      })
      .finally(() => { if (!cancelled) setSharedDiagLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey, mobTotalGasto, mobTotalEntradas, mobScore, workspace.id]);

  const D = {
    shell: {
      minHeight: "100vh",
      background: "#050505",
      color: "#fff",
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      display: "flex",
      flexDirection: "column" as const
    },
    topbar: {
      position: "sticky" as const,
      top: 0,
      zIndex: 20,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 clamp(16px,4vw,40px)",
      height: 60,
      background: "rgba(5,5,5,0.65)",
      borderBottom: "1px solid rgba(255,255,255,0.07)",
      backdropFilter: "blur(20px)",
      gap: 16
    },
    content: {
      flex: 1,
      width: "min(1200px,calc(100% - 32px))",
      margin: "0 auto",
      padding: "32px 0 80px",
      display: "grid",
      gap: 24
    }
  };

  return (
    <div style={D.shell}>
      <style>{`
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        .ws-tx-row:hover{background:rgba(255,255,255,0.03)!important}
        .ws-filter-btn{cursor:pointer;transition:all .18s}
        .ws-icon-btn:hover{background:rgba(255,255,255,0.08)!important;color:#fff!important}
        @media(max-width:960px){.ws-sidebar{display:none}.ws-grid{grid-template-columns:1fr}}
      `}</style>

      {/* Topbar */}
      <header className="ws-topbar" style={D.topbar}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Logo />
          <div className="ws-top-workspace" style={{ display: "flex", alignItems: "center" }}>
            {workspaces.length > 1 ? (
              <select
                value={workspace.id}
                onChange={(e) => onSelectWorkspace(e.target.value)}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 13,
                  padding: "6px 10px",
                  cursor: "pointer"
                }}
              >
                {workspaces.map((e) => (
                  <option key={e.workspace.id} value={e.workspace.id}>
                    {e.workspace.name}
                  </option>
                ))}
              </select>
            ) : (
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.46)" }}>
                {workspace.name}
              </span>
            )}
          </div>
        </div>

        <div className="ws-top-right" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="ws-top-month" style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, overflow: "hidden" }}>
            <button
              onClick={() => {
                const [y, m] = monthKey.split("-").map(Number);
                const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
                setMonthKey(prev);
              }}
              style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", padding: "6px 8px", display: "flex", alignItems: "center", transition: "color .15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
            >
              <ChevronLeft size={14} />
            </button>
            <input
              type="month"
              value={monthKey}
              onChange={(e) => setMonthKey(e.target.value)}
              style={{
                background: "transparent",
                border: "none",
                color: "#fff",
                fontSize: 13,
                padding: "6px 4px",
                cursor: "pointer",
                outline: "none"
              }}
            />
            <button
              onClick={() => {
                const [y, m] = monthKey.split("-").map(Number);
                const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
                setMonthKey(next);
              }}
              style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", padding: "6px 8px", display: "flex", alignItems: "center", transition: "color .15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
            >
              <ChevronRight size={14} />
            </button>
          </div>
          {/* Avatar menu */}
          <div ref={avatarRef} style={{ position: "relative" }}>
            <button
              onClick={() => setAvatarOpen((o) => !o)}
              title={profile.displayName || "Menu"}
              style={{
                width: 34, height: 34, borderRadius: "50%",
                background: G, border: "2px solid rgba(184,245,90,0.3)",
                cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 13, fontWeight: 700,
                color: "#050505", transition: "opacity .15s", flexShrink: 0
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = ".82")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              {(profile.displayName || "U").charAt(0).toUpperCase()}
            </button>

            {avatarOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 10px)", right: 0,
                background: "#0e0f11", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 16, width: 248, zIndex: 200,
                boxShadow: "0 20px 60px rgba(0,0,0,0.65)",
                overflow: "hidden"
              }}>
                {/* User info */}
                <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: G, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#050505", flexShrink: 0 }}>
                    {(profile.displayName || "U").charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {profile.displayName || user.email?.split("@")[0]}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {user.email}
                    </div>
                  </div>
                </div>

                {/* Body items */}
                <div style={{ padding: "6px" }}>
                  {[
                    {
                      icon: <Users size={15} color="rgba(255,255,255,0.45)" />,
                      label: "Pessoas",
                      onClick: () => { setAvatarOpen(false); window.location.href = `${BASE}/members?workspace=${workspace.id}`; }
                    },
                    {
                      icon: <Pencil size={15} color="rgba(255,255,255,0.45)" />,
                      label: "Renomear conta",
                      sub: workspace.name,
                      onClick: () => { setRenameWsValue(workspace.name); setAvatarOpen(false); setRenameWsOpen(true); }
                    },
                    {
                      icon: <Crown size={15} color="rgba(255,255,255,0.45)" />,
                      label: "Meu plano",
                      badge: "BETA",
                      onClick: () => setAvatarOpen(false)
                    }
                  ].map(({ icon, label, sub, badge, onClick }) => (
                    <button
                      key={label}
                      onClick={onClick}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, background: "transparent", border: "none", cursor: "pointer", textAlign: "left", transition: "background .15s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {icon}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>{label}</div>
                        {sub && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
                      </div>
                      {badge && (
                        <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(184,245,90,0.12)", color: G, border: `1px solid rgba(184,245,90,0.2)`, padding: "2px 7px", borderRadius: 6, letterSpacing: "0.04em", flexShrink: 0 }}>
                          {badge}
                        </span>
                      )}
                    </button>
                  ))}

                  <a
                    href="https://wa.me/5521966939829"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setAvatarOpen(false)}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, background: "transparent", textDecoration: "none", transition: "background .15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <WhatsAppIcon />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>Falar com suporte</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>Abre no WhatsApp</div>
                    </div>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 17L17 7M17 7H7M17 7v10"/>
                    </svg>
                  </a>
                </div>

                {/* Footer — logout */}
                <div style={{ padding: "6px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                  <button
                    onClick={() => { setAvatarOpen(false); signOut(auth); }}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, background: "transparent", border: "none", cursor: "pointer", transition: "background .15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,80,80,0.08)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <LogOut size={15} color="#ff8080" />
                    <span style={{ fontSize: 13, color: "#ff8080" }}>Sair</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="ws-main-content ws-desktop-layout" style={D.content}>
        {/* Demo banner */}

        {error && (
          <div
            style={{
              background: "rgba(255,80,80,0.1)",
              border: "1px solid rgba(255,80,80,0.25)",
              borderRadius: 12,
              padding: "12px 16px",
              fontSize: 13,
              color: "#ff8080"
            }}
          >
            {error}
          </div>
        )}

        {/* Balance header */}
        <BalanceHeader
          summary={summary}
          showDemo={showDemo}
          monthKey={monthKey}
          prevMonthKey={prevMonthKey}
          prevExpense={prevTransactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0)}
          prevIncome={prevTransactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0)}
        />

        {/* Main grid */}
        <div className="ws-grid">
          {/* Left column */}
          <div style={{ display: "grid", gap: 20 }}>
            {/* Upload zone */}
            <UploadZone
              onFiles={handleFiles}
              onAddManual={() => setAddOpen(true)}
            />

            {/* View tabs */}
            <WsCard>
              {/* Aba switcher */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: 3 }}>
                  {(["diagnostico", "lancamentos"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      style={{
                        fontSize: 12.5, fontWeight: 700, padding: "5px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                        background: view === v ? "rgba(255,255,255,0.10)" : "transparent",
                        color: view === v ? "#fff" : "rgba(255,255,255,0.38)",
                        transition: "all .15s"
                      }}
                    >
                      {v === "diagnostico" ? "Visão Geral" : "Transações"}
                    </button>
                  ))}
                </div>

                {view === "lancamentos" && (
                  <div style={{ display: "flex", gap: 6 }}>
                    {(["all", "income", "expense"] as const).map((f) => (
                      <button
                        key={f}
                        className="ws-filter-btn"
                        onClick={() => setTxFilter(f)}
                        style={{
                          fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 999, border: "none",
                          background: txFilter === f
                            ? f === "income" ? "rgba(184,245,90,0.15)" : f === "expense" ? "rgba(255,80,80,0.15)" : "rgba(255,255,255,0.10)"
                            : "transparent",
                          color: txFilter === f
                            ? f === "income" ? G : f === "expense" ? "#ff8080" : "#fff"
                            : "rgba(255,255,255,0.38)"
                        }}
                      >
                        {f === "all" ? "Todas" : f === "income" ? "Entradas" : "Saídas"}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {view === "lancamentos" ? (<>
                {/* Source tabs */}
                {sources.length > 1 && (
                  <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                    {(["all", ...sources] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSourceFilter(s)}
                        style={{
                          fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 999,
                          border: `1px solid ${sourceFilter === s ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)"}`,
                          background: sourceFilter === s ? "rgba(255,255,255,0.10)" : "transparent",
                          color: sourceFilter === s ? "#fff" : "rgba(255,255,255,0.38)", cursor: "pointer"
                        }}
                      >
                        {s === "all" ? "Tudo" : s}
                      </button>
                    ))}
                  </div>
                )}

                {txLoading ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(255,255,255,0.28)", fontSize: 13 }}>
                    Carregando lançamentos...
                  </div>
                ) : filteredTx.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.24)", fontSize: 13 }}>
                    Nenhum lançamento neste mês.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 2 }}>
                    {filteredTx.slice(0, 10).map((tx) => (
                      <TxRow
                        key={tx.id}
                        tx={tx}
                        readonly={showDemo}
                        onDelete={async () => deleteDoc(doc(db, "workspaces", workspace.id, "transactions", tx.id))}
                      />
                    ))}
                    {filteredTx.length > 10 && (
                      <button
                        onClick={() => {
                          localStorage.setItem("fincheck_workspace", workspace.id);
                          router.push(`/transactions?month=${monthKey}`);
                        }}
                        style={{
                          marginTop: 6, padding: "10px 0", borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.08)", background: "transparent",
                          color: "rgba(255,255,255,0.45)", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 6
                        }}
                      >
                        Ver todas as {filteredTx.length} transações <ArrowRight size={13} />
                      </button>
                    )}
                  </div>
                )}
              </>) : (
                <InsightsView
                  transactions={showDemo ? demoTransactions : transactions}
                  prevTransactions={showDemo ? [] : prevTransactions}
                  monthKey={showDemo ? "2026-04" : monthKey}
                  workspaceId={workspace.id}
                  renda={monthlyIncome}
                  onRendaChange={handleRendaChange}
                  aiDiag={sharedAiDiag}
                  diagLoading={sharedDiagLoading}
                  diagError={sharedDiagError}
                />
              )}
            </WsCard>

            {/* Card de convite — coluna principal */}
            {isOwner && (
              <WsCard>
                <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>Gerencie as finanças com mais alguém</h3>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", lineHeight: 1.6, marginBottom: 14 }}>
                  Convide uma pessoa para acompanhar entradas, gastos e o planejamento do mês — em tempo real.
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{ display: "flex" }}>
                    {wsMembers.slice(0, 3).map((m, i) => {
                      const initial = (m.displayName || m.email || "?")[0].toUpperCase();
                      const isMe = m.uid === user.uid;
                      return (
                        <div key={m.uid} style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, border: "2px solid #09090b", marginLeft: i > 0 ? -8 : 0, background: isMe ? G : "rgba(184,245,90,0.12)", color: isMe ? "#050505" : G, flexShrink: 0 }}>
                          {initial}
                        </div>
                      );
                    })}
                    <div style={{ width: 28, height: 28, borderRadius: "50%", border: "1px dashed rgba(255,255,255,0.2)", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: wsMembers.length > 0 ? -8 : 0, flexShrink: 0 }}>
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", lineHeight: 1 }}>+</span>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.38)" }}>
                    {wsMembers.length <= 1
                      ? "Só você por aqui ainda"
                      : wsMembers.length === 2
                        ? `Você e ${wsMembers.find(m => m.uid !== user.uid)?.displayName?.split(" ")[0] || "outro"} já gerenciam juntos`
                        : `Você e mais ${wsMembers.length - 1} pessoas já gerenciam juntos`}
                  </p>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  <button
                    onClick={async () => { if (!inviteLink) await createInvite(); setInviteModal("whatsapp"); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 700, color: "#fff", background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.22)", borderRadius: 8, padding: "9px 12px", cursor: "pointer", justifyContent: "center" }}
                  >
                    <WhatsAppIcon /> Convidar pelo WhatsApp
                  </button>
                  <button
                    onClick={async () => { if (!inviteLink) await createInvite(); setInviteModal("email"); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,0.7)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "9px 12px", cursor: "pointer", justifyContent: "center" }}
                  >
                    <GmailIcon /> Convidar por e-mail
                  </button>
                </div>
              </WsCard>
            )}
          </div>

          {/* Right sidebar */}
          <aside className="ws-sidebar" style={{ display: "grid", gap: 16 }}>
            <PlanCard
              monthKey={showDemo ? "2026-04" : monthKey}
              summary={planSummary}
              plannedItems={showDemo ? [] : plannedItems}
              recurringItems={showDemo ? [] : recurringItems}
              readonly={showDemo}
              onAdd={() => setPlanOpen(true)}
              onStatusChange={updatePlannedStatus}
              onDelete={(item) =>
                deleteDoc(doc(db, "workspaces", workspace.id, "plannedItems", item.id))
              }
              onDeactivateRecurring={(r) =>
                updateDoc(doc(db, "workspaces", workspace.id, "recurringItems", r.id), {
                  active: false,
                  updatedAt: serverTimestamp()
                })
              }
              onEditRecurring={(r) => setEditRecurringItem(r)}
            />

            {/* Projeção link */}
            <button
              onClick={() => { localStorage.setItem("fincheck_workspace", workspace.id); router.push("/projecao"); }}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "11px 0", borderRadius: 10, background: "rgba(184,245,90,0.06)", border: "1px solid rgba(184,245,90,0.14)", color: G, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
            >
              <TrendingUp size={14} /> Projeção 12 meses
            </button>

            {/* Metas link */}
            <button
              onClick={() => { localStorage.setItem("fincheck_workspace", workspace.id); router.push("/metas"); }}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "11px 0", borderRadius: 10, background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.18)", color: "#a78bfa", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
            >
              <Target size={14} /> Metas financeiras
            </button>
          </aside>
        </div>
      </div>

      {/* ── Mobile layout ──────────────────────────────────── */}
      <div className="ws-mobile-layout">

        {/* Workspace pills */}
        <div className="mob-ws-pills">
          {workspaces.map((e) => (
            <button
              key={e.workspace.id}
              type="button"
              onClick={() => onSelectWorkspace(e.workspace.id)}
              className={`mob-ws-pill ${e.workspace.id === workspace.id ? "active" : "inactive"}`}
            >
              {e.workspace.name}
            </button>
          ))}
          <button
            type="button"
            className="mob-ws-add"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setEmBrevePos({ bottom: window.innerHeight - r.top + 8, centerX: r.left + r.width / 2 });
              setTimeout(() => setEmBrevePos(null), 2200);
            }}
          >+</button>
        </div>
        {emBrevePos && (
          <div style={{
            position: "fixed", bottom: emBrevePos.bottom, left: emBrevePos.centerX,
            transform: "translateX(-50%)",
            background: "rgba(28,28,28,0.97)", border: "1px solid rgba(255,255,255,0.13)",
            borderRadius: 10, padding: "6px 12px", fontSize: 12, fontWeight: 600,
            color: "rgba(255,255,255,0.75)", whiteSpace: "nowrap", zIndex: 9999,
            backdropFilter: "blur(8px)", boxShadow: "0 4px 20px rgba(0,0,0,0.45)",
            pointerEvents: "none"
          }}>
            <div style={{
              position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%) rotate(45deg)",
              width: 8, height: 8,
              background: "rgba(28,28,28,0.97)", border: "1px solid rgba(255,255,255,0.13)",
              borderTop: "none", borderLeft: "none"
            }} />
            Em breve!
          </div>
        )}

        {/* 1. Saldo do mês */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "20px 16px 16px" }}>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.36)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
            Saldo do mês
          </p>
          <p style={{ fontSize: 38, fontWeight: 900, letterSpacing: "-0.04em", color: summary.balance >= 0 ? G : "#ff8080", lineHeight: 1, marginBottom: 4 }}>
            {formatCurrency(summary.balance)}
          </p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.32)", marginBottom: 16 }}>
            {monthLabel(showDemo ? "2026-04" : monthKey)}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {(() => {
              const prevMonthShort = (() => { const [y, m] = prevMonthKey.split("-").map(Number); return `${["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"][m-1]}/${String(y).slice(2)}`; })();
              type MiniCell = { label: string; value: string; color: string; badge: { arrow: "up"|"down"|null; arrowColor: string; pct: string; ctx: string } | null; plain?: string };
              const cells: MiniCell[] = [
                {
                  label: "Entradas", value: `+${formatCurrency(summary.income)}`, color: G,
                  badge: mobIncomeChange !== null ? {
                    arrow: mobIncomeChange > 0 ? "up" : "down",
                    arrowColor: mobIncomeChange >= 0 ? G : "#ff8080",
                    pct: `${Math.abs(mobIncomeChange).toFixed(1)}%`,
                    ctx: `vs ${formatCurrency(mobPrevIncome)} ${prevMonthShort}`
                  } : null
                },
                {
                  label: "Saídas", value: `−${formatCurrency(summary.expense)}`, color: "#ff8080",
                  badge: mobExpenseChange !== null ? {
                    arrow: mobExpenseChange > 0 ? "up" : "down",
                    arrowColor: mobExpenseChange <= 0 ? G : "#ff8080",
                    pct: `${Math.abs(mobExpenseChange).toFixed(1)}%`,
                    ctx: `vs ${formatCurrency(mobPrevExpense)} ${prevMonthShort}`
                  } : null,
                  plain: summary.accountExpense > 0 && summary.cardExpense > 0
                    ? `🏦 ${formatCurrency(summary.accountExpense)} · 💳 ${formatCurrency(summary.cardExpense)}`
                    : undefined
                },
                {
                  label: "Economia", value: summary.savingsRate !== null ? `${summary.savingsRate.toFixed(0)}%` : "—", color: G,
                  badge: mobSavingsChange !== null ? {
                    arrow: mobSavingsChange > 0 ? "up" : "down",
                    arrowColor: mobSavingsChange >= 0 ? G : "#ff8080",
                    pct: `${Math.abs(Math.round(mobSavingsChange))}pp`,
                    ctx: `vs ${prevSavingsRate}% ${prevMonthShort}`
                  } : null
                },
                {
                  label: "Média de gastos/dia", value: formatCurrency(mobMediaDia), color: "rgba(255,255,255,0.75)",
                  badge: null, plain: `${mobExpenses.length} transações`
                }
              ];
              return cells.map(({ label, value, color, badge, plain }) => (
                <div key={label} style={{ background: "#050505", borderRadius: 12, padding: "10px 12px", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.36)", marginBottom: 4 }}>{label}</p>
                  <p style={{ fontSize: 15, fontWeight: 800, color, letterSpacing: "-0.02em" }}>{value}</p>
                  {badge && (
                    <div style={{ marginTop: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: badge.arrowColor }}>
                        {badge.arrow === "up" ? "▲" : "▼"} {badge.pct}
                      </span>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", marginLeft: 4 }}>
                        {badge.ctx}
                      </span>
                    </div>
                  )}
                  {plain && <p style={{ fontSize: 10, color: "rgba(255,255,255,0.32)", marginTop: 4 }}>{plain}</p>}
                </div>
              ));
            })()}
          </div>
        </div>

        {/* 2. Diagnóstico do mês */}
        {mobExpenses.length > 0 && (
          <div style={{ border: `1px solid rgba(${mobScoreRgb},0.18)`, background: `rgba(${mobScoreRgb},0.04)`, borderRadius: 14, padding: "16px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -60, right: -60, width: 220, height: 220, borderRadius: "50%", background: `rgba(${mobScoreRgb},0.10)`, filter: "blur(55px)", pointerEvents: "none" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 16, position: "relative" }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 10.5, color: `rgba(${mobScoreRgb},0.65)`, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  Diagnóstico do mês
                  {sharedDiagLoading && <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: `rgba(${mobScoreRgb},0.5)`, animation: "pulse 1.2s ease-in-out infinite" }} />}
                </p>
                <p style={{ fontSize: 24, fontWeight: 900, color: mobScoreColor, letterSpacing: "-0.03em", marginBottom: 10, lineHeight: 1.1 }}>
                  {sharedAiDiag?.scoreLabel ?? mobScoreLabel}
                </p>
                <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.42)", lineHeight: 1.65, marginBottom: ((sharedAiDiag?.bullet1 ?? mobBullet1) || (sharedAiDiag?.bullet2 ?? mobBullet2)) ? 10 : 0, transition: "opacity .4s", opacity: sharedDiagLoading ? 0.5 : 1 }}>
                  {sharedAiDiag?.narrativa ?? mobNarrativa}
                </p>
                {((sharedAiDiag?.bullet1 ?? mobBullet1) || (sharedAiDiag?.bullet2 ?? mobBullet2)) && (
                  <div style={{ display: "grid", gap: 5 }}>
                    {(sharedAiDiag?.bullet1 ?? mobBullet1) && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: `rgba(${mobScoreRgb},0.55)`, transition: "opacity .4s", opacity: sharedDiagLoading ? 0.5 : 1 }}>
                        <span style={{ flexShrink: 0, marginTop: 1 }}>↗</span>{sharedAiDiag?.bullet1 ?? mobBullet1}
                      </div>
                    )}
                    {(sharedAiDiag?.bullet2 ?? mobBullet2) && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: `rgba(${mobScoreRgb},0.55)`, transition: "opacity .4s", opacity: sharedDiagLoading ? 0.5 : 1 }}>
                        <span style={{ flexShrink: 0, marginTop: 1 }}>{mobExpenseChange !== null && mobExpenseChange < 0 ? "↘" : "↗"}</span>{sharedAiDiag?.bullet2 ?? mobBullet2}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p style={{ fontSize: 36, fontWeight: 900, color: mobScoreColor, lineHeight: 1, letterSpacing: "-0.03em" }}>
                  {mobScore !== null ? mobScore.toFixed(1).replace(".", ",") : "—"}
                </p>
                <p style={{ fontSize: 10, color: `rgba(${mobScoreRgb},0.5)`, marginTop: 2 }}>/ nota</p>
              </div>
            </div>
          </div>
        )}

        {/* 3. Gastos por dia */}
        {mobExpenses.length > 0 && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "16px" }}>
            <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.36)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Gastos por dia</p>
            <DailySpendChart byDay={mobByDay} monthKey={showDemo ? "2026-04" : monthKey} prevByDay={mobPrevByDay} prevMonthKey={prevMonthKey} />
          </div>
        )}

        {/* 3. Renda mensal */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.36)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Renda mensal</p>
            <button onClick={() => { setRendaMobText(monthlyIncome > 0 ? maskBRL(String(monthlyIncome * 100)) : ""); setEditingRendaMob(true); }} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", padding: 2, display: "flex", alignItems: "center" }}><Pencil size={13} /></button>
          </div>
          {editingRendaMob ? (
            <input type="text" inputMode="numeric" autoFocus
              value={rendaMobText}
              placeholder="R$ 0,00"
              onChange={(e) => setRendaMobText(maskBRL(e.target.value))}
              onBlur={() => { handleRendaChange(parseBRL(rendaMobText)); setEditingRendaMob(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, outline: "none", color: "#fff", fontSize: 18, fontWeight: 800, width: "100%", padding: "6px 10px", marginBottom: 10 }}
            />
          ) : (
            <p onClick={() => { setRendaMobText(monthlyIncome > 0 ? maskBRL(String(monthlyIncome * 100)) : ""); setEditingRendaMob(true); }} style={{ fontSize: 18, fontWeight: 800, color: monthlyIncome > 0 ? "#fff" : "rgba(255,255,255,0.3)", letterSpacing: "-0.03em", cursor: "pointer", marginBottom: 10 }}>
              {monthlyIncome > 0 ? formatCurrency(monthlyIncome) : "Declarar renda"}
            </p>
          )}
          <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 6 }}>
            <div style={{ height: "100%", borderRadius: 2, width: `${Math.min(100, mobComprometimento)}%`, background: mobComprometimento > 90 ? "#ff8080" : mobComprometimento > 75 ? "#facc15" : G, transition: "width .5s cubic-bezier(.4,0,.2,1)" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.32)" }}>{formatCurrency(mobTotalGasto)} gastos</span>
            <span style={{ fontSize: 10.5, color: mobComprometimento > 75 ? "#ff8080" : "rgba(255,255,255,0.32)", fontWeight: 700 }}>{mobComprometimento}% comprometida</span>
          </div>
        </div>

        {/* 4. Importar extrato */}
        <UploadZone onFiles={handleFiles} onAddManual={() => setAddOpen(true)} />

        {/* 5. Plano do mês */}
        <PlanCard
          monthKey={showDemo ? "2026-04" : monthKey}
          summary={planSummary}
          plannedItems={showDemo ? [] : plannedItems}
          recurringItems={showDemo ? [] : recurringItems}
          readonly={showDemo}
          onAdd={() => setPlanOpen(true)}
          onStatusChange={updatePlannedStatus}
          onDelete={(item) => deleteDoc(doc(db, "workspaces", workspace.id, "plannedItems", item.id))}
          onDeactivateRecurring={(r) => updateDoc(doc(db, "workspaces", workspace.id, "recurringItems", r.id), { active: false, updatedAt: serverTimestamp() })}
          onEditRecurring={(r) => setEditRecurringItem(r)}
        />

        {/* 6. Top categorias */}
        {mobByCategory.length > 0 && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.36)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Top categorias</p>
              <button onClick={() => { localStorage.setItem("fincheck_workspace", workspace.id); router.push(`/top-categories?month=${showDemo ? "2026-04" : monthKey}`); }}
                style={{ fontSize: 11, color: G, background: "transparent", border: "none", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 3, opacity: 0.8 }}>
                ver todas <ArrowRight size={11} />
              </button>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {mobByCategory.slice(0, 3).map(([cat, total]) => {
                const color = (CATEGORY_COLORS as Record<string, string>)[cat] ?? "#888";
                const pct = Math.round((total / mobTotalGasto) * 100);
                return (
                  <div key={cat} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <CategoryAvatar categoria={cat} size={28} radius={8} />
                    <span style={{ flex: 1, fontSize: 13, color: "rgba(255,255,255,0.78)", fontWeight: 600 }}>{cat}</span>
                    <div style={{ width: 60, height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.round((total / mobMaxCategory) * 100)}%`, background: color, borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.36)", minWidth: 28, textAlign: "right" }}>{pct}%</span>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", minWidth: 72, textAlign: "right" }}>{formatCurrency(total)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 7. Transações recentes */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.36)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Transações recentes</p>
            <button onClick={() => { localStorage.setItem("fincheck_workspace", workspace.id); router.push(`/transactions?month=${showDemo ? "2026-04" : monthKey}`); }}
              style={{ fontSize: 11, color: G, background: "transparent", border: "none", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 3, opacity: 0.8 }}>
              ver todas <ArrowRight size={11} />
            </button>
          </div>
          {mobRecentTx.length === 0 ? (
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", textAlign: "center", padding: "12px 0" }}>Nenhuma transação.</p>
          ) : (
            <div>
              {mobRecentTx.map((tx) => {
                const isIncome = tx.type === "income";
                const parts = tx.date.split("-");
                const dateLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}` : tx.date;
                const color = categoryColor(tx.category);
                return (
                  <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: isIncome ? "rgba(184,245,90,0.08)" : "rgba(255,255,255,0.05)", border: `1px solid ${isIncome ? "rgba(184,245,90,0.15)" : "rgba(255,255,255,0.08)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}66` }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(232,233,236,0.9)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.description}</p>
                      <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.32)", marginTop: 2 }}>{tx.category} · {dateLabel}</p>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: isIncome ? G : "#ff8080", letterSpacing: "-0.02em", flexShrink: 0 }}>
                      {isIncome ? "+" : "−"}{formatCurrency(tx.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 8. Assinaturas */}
        {mobSubscriptions.length > 0 && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "16px" }}>
            <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.36)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Assinaturas</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginBottom: 2 }}>
              {formatCurrency(mobSubscriptions.reduce((s, [, v]) => s + v, 0))}
              <span style={{ fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.36)", marginLeft: 4 }}>/mês</span>
            </p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginBottom: 12 }}>{mobSubscriptions.length} detectada{mobSubscriptions.length !== 1 ? "s" : ""}</p>
            <div>
              {mobSubscriptions.map(([desc, total]) => (
                <div key={desc} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, color: "rgba(232,233,236,0.85)", fontWeight: 500 }}>{desc}</p>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#ff8080" }}>−{formatCurrency(total)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 9. Convidar membro */}
        {isOwner && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "16px" }}>
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>Gerencie as finanças com mais alguém</p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", lineHeight: 1.5, marginBottom: 14 }}>Convide uma pessoa para acompanhar entradas, gastos e o planejamento do mês — em tempo real.</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ display: "flex" }}>
                {wsMembers.slice(0, 3).map((m, i) => {
                  const initial = (m.displayName || m.email || "?")[0].toUpperCase();
                  const isMe = m.uid === user.uid;
                  return (
                    <div key={m.uid} style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, border: "2px solid #09090b", marginLeft: i > 0 ? -8 : 0, background: isMe ? G : "rgba(184,245,90,0.12)", color: isMe ? "#050505" : G, flexShrink: 0 }}>
                      {initial}
                    </div>
                  );
                })}
                <div style={{ width: 28, height: 28, borderRadius: "50%", border: "1px dashed rgba(255,255,255,0.2)", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: wsMembers.length > 0 ? -8 : 0, flexShrink: 0 }}>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", lineHeight: 1 }}>+</span>
                </div>
              </div>
              <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.38)" }}>
                {wsMembers.length <= 1
                  ? "Só você por aqui ainda"
                  : wsMembers.length === 2
                    ? `Você e ${wsMembers.find(m => m.uid !== user.uid)?.displayName?.split(" ")[0] || "outro"} já gerenciam juntos`
                    : `Você e mais ${wsMembers.length - 1} pessoas já gerenciam juntos`}
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={async () => { if (!inviteLink) await createInvite(); setInviteModal("whatsapp"); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", borderRadius: 10, background: "rgba(37,211,102,0.10)", border: "1px solid rgba(37,211,102,0.18)", color: "#4dcc8f", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <WhatsAppIcon /> Convidar pelo WhatsApp
              </button>
              <button onClick={async () => { if (!inviteLink) await createInvite(); setInviteModal("email"); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <GmailIcon /> Convidar por e-mail
              </button>
            </div>
          </div>
        )}

        {/* 10. Projeção 12 meses */}
        <button onClick={() => { localStorage.setItem("fincheck_workspace", workspace.id); router.push("/projecao"); }}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(184,245,90,0.08)", border: "1px solid rgba(184,245,90,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <TrendingUp size={16} color={G} />
            </div>
            <div style={{ textAlign: "left" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(232,233,236,0.9)" }}>Projeção 12 meses</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.36)", marginTop: 2 }}>Veja para onde suas finanças vão</p>
            </div>
          </div>
          <ArrowRight size={16} color="rgba(255,255,255,0.3)" />
        </button>

        {/* 11. Metas financeiras */}
        <button onClick={() => { localStorage.setItem("fincheck_workspace", workspace.id); router.push("/metas"); }}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Target size={16} color="#a78bfa" />
            </div>
            <div style={{ textAlign: "left" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(232,233,236,0.9)" }}>Metas financeiras</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.36)", marginTop: 2 }}>Defina e acompanhe seus objetivos</p>
            </div>
          </div>
          <ArrowRight size={16} color="rgba(255,255,255,0.3)" />
        </button>

      </div>
      {/* ── End mobile layout ── */}

      {/* Add manual modal */}
      {addOpen && (
        <AddTransactionModal
          user={user}
          profile={profile}
          workspaceId={workspace.id}
          monthKey={monthKey}
          onClose={() => setAddOpen(false)}
          onCreated={async () => {
            await markReal();
            setAddOpen(false);
          }}
        />
      )}

      {/* Import preview modal */}
      {importState && (
        <ImportModal
          state={importState}
          onCancel={() => setImportState(null)}
          onConfirm={confirmImport}
          onToggle={(id) =>
            importState.phase === "preview" &&
            setImportState({
              ...importState,
              rows: importState.rows.map((r) =>
                r._id === id ? { ...r, selected: !r.selected } : r
              )
            })
          }
          onCategoryChange={(id, cat) =>
            importState.phase === "preview" &&
            setImportState({
              ...importState,
              rows: importState.rows.map((r) =>
                r._id === id ? { ...r, category: cat } : r
              )
            })
          }
        />
      )}

      {/* Reconcile modal */}
      {reconcilePrompt.length > 0 && (
        <ReconcileModal
          items={reconcilePrompt}
          onChange={setReconcilePrompt}
          onClose={() => setReconcilePrompt([])}
          onConfirm={async (items) => {
            try {
              for (const item of items.filter((i) => i.include)) {
                const docId = `fatura_${item.sourceLabel.replace(/\s+/g, "_")}_${item.monthKey}`;
                await setDoc(
                  doc(db, "workspaces", workspace.id, "plannedItems", docId),
                  {
                    type: "expense",
                    title: `Cartão ${item.sourceLabel}`,
                    amount: Math.round(item.amount * 100) / 100,
                    category: "Contas",
                    dueDay: 10,
                    monthKey: item.monthKey,
                    status: "planned",
                    createdBy: user.uid,
                    createdByName: profile.displayName,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                  },
                  { merge: true }
                );
              }
              setReconcilePrompt([]);
            } catch (err) {
              setError(getUserFacingError(err, "data"));
            }
          }}
        />
      )}

      {/* Invite modal */}
      {inviteModal && (
        <InviteContactModal
          type={inviteModal}
          workspaceName={workspace.name}
          inviteLink={inviteLink}
          senderName={profile?.displayName || user.displayName || "Alguém"}
          members={wsMembers}
          onClose={() => setInviteModal(null)}
        />
      )}

      {/* Plan item modal */}
      {planOpen && (
        <AddPlannedItemModal
          user={user}
          profile={profile}
          workspaceId={workspace.id}
          monthKey={monthKey}
          onClose={() => setPlanOpen(false)}
          onCreated={() => setPlanOpen(false)}
        />
      )}

      {editRecurringItem && (
        <EditRecurringModal
          item={editRecurringItem}
          monthKey={monthKey}
          workspaceId={workspace.id}
          onClose={() => setEditRecurringItem(null)}
          onSaved={() => setEditRecurringItem(null)}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          workspace={workspace}
          member={member}
          isOwner={isOwner}
          onClose={() => setSettingsOpen(false)}
          onDelete={deleteWorkspace}
          onLeave={async () => {
            await updateDoc(
              doc(db, "workspaces", workspace.id, "members", user.uid),
              { status: "left", leftAt: serverTimestamp() }
            );
          }}
        />
      )}

      {/* Rename workspace modal */}
      {renameWsOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={(e) => e.target === e.currentTarget && setRenameWsOpen(false)}
        >
          <div style={{ background: "#0e0f11", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: 24, width: "100%", maxWidth: 340, boxShadow: "0 40px 100px rgba(0,0,0,0.6)" }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Renomear conta</p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 20, lineHeight: 1.5 }}>
              Esse nome aparece no header e nos convites que você enviar.
            </p>
            <input
              autoFocus
              maxLength={40}
              value={renameWsValue}
              onChange={(e) => setRenameWsValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && renameWsValue.trim() && (async () => {
                const name = renameWsValue.trim();
                await updateDoc(doc(db, "workspaces", workspace.id), { name, updatedAt: serverTimestamp() });
                onRenameWorkspace(workspace.id, name);
                setRenameWsOpen(false);
              })()}
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 12px", fontSize: 14, color: "#fff", fontFamily: "inherit", outline: "none", transition: "border-color .15s", marginBottom: 16 }}
              onFocus={(e) => (e.currentTarget.style.borderColor = G)}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setRenameWsOpen(false)}
                style={{ flex: 1, padding: "10px", borderRadius: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 13, fontFamily: "inherit", transition: "background .15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const name = renameWsValue.trim();
                  if (!name) return;
                  await updateDoc(doc(db, "workspaces", workspace.id), { name, updatedAt: serverTimestamp() });
                  onRenameWorkspace(workspace.id, name);
                  setRenameWsOpen(false);
                }}
                disabled={!renameWsValue.trim()}
                style={{ flex: 1, padding: "10px", borderRadius: 10, background: G, border: "none", color: "#050505", cursor: renameWsValue.trim() ? "pointer" : "default", fontSize: 13, fontWeight: 700, fontFamily: "inherit", opacity: renameWsValue.trim() ? 1 : 0.4, transition: "opacity .15s" }}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Monthly plan ────────────────────────────────────────────────────────────

function PlanCard({
  monthKey,
  summary,
  plannedItems,
  recurringItems,
  readonly,
  onAdd,
  onStatusChange,
  onDelete,
  onDeactivateRecurring,
  onEditRecurring
}: {
  monthKey: string;
  summary: ReturnType<typeof buildMonthlyPlanSummary>;
  plannedItems: PlannedItem[];
  recurringItems: RecurringItem[];
  readonly: boolean;
  onAdd: () => void;
  onStatusChange: (item: PlannedItem, status: PlannedItemStatus) => Promise<void>;
  onDelete: (item: PlannedItem) => Promise<void>;
  onDeactivateRecurring: (r: RecurringItem) => Promise<void>;
  onEditRecurring: (r: RecurringItem) => void;
}) {
  const [showRecurring, setShowRecurring] = useState(false);
  const [showPaid, setShowPaid] = useState(false);
  const projectedPositive = summary.projectedBalance >= 0;
  const pendingItems = plannedItems.filter((item) => item.status === "planned");
  const paidItems = plannedItems.filter((item) => item.status === "paid");
  const activeItems = plannedItems.filter((item) => item.status !== "skipped");

  return (
    <WsCard>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Plano do mês</h3>
          <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.34)", lineHeight: 1.5 }}>
            Previsto para {monthLabel(monthKey)}
          </p>
        </div>
        {!readonly && (
          <button
            onClick={onAdd}
            title="Adicionar ao plano"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: "1px solid rgba(184,245,90,0.22)",
              background: "rgba(184,245,90,0.10)",
              color: G,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Plus size={15} />
          </button>
        )}
      </div>

      <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.34)" }}>Sobra projetada</span>
          <strong style={{ fontSize: 18, color: projectedPositive ? G : "#ff8080", letterSpacing: "-0.03em", whiteSpace: "nowrap" }}>
            {formatCurrency(summary.projectedBalance)}
          </strong>
        </div>
        <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />
        <PlanMetric label="Ja entrou" value={summary.paidIncome} tone="income" />
        <PlanMetric label="Ainda entra" value={summary.pendingIncome} tone="income" />
        <PlanMetric label="Ja saiu" value={summary.paidExpense} tone="expense" />
        <PlanMetric label="Ainda sai" value={summary.pendingExpense} tone="expense" />
      </div>

      {activeItems.length === 0 ? (
        <div
          style={{
            border: "1px dashed rgba(255,255,255,0.12)",
            borderRadius: 10,
            padding: "14px 12px",
            color: "rgba(255,255,255,0.34)",
            fontSize: 12,
            lineHeight: 1.55
          }}
        >
          Adicione salario, aluguel, cartao ou qualquer conta prevista para o Salvô! mostrar o que ainda falta e quanto deve sobrar.
        </div>
      ) : (
        <>
          {/* Itens pendentes */}
          {pendingItems.length > 0 && (
            <div style={{ display: "grid", gap: 8 }}>
              {pendingItems.map((item) => (
                <PlanItemRow
                  key={item.id}
                  item={item}
                  readonly={readonly}
                  onStatusChange={onStatusChange}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}

          {/* Seção colapsável: Já resolvido */}
          {paidItems.length > 0 && (
            <div style={{ marginTop: pendingItems.length > 0 ? 12 : 0 }}>
              <button
                onClick={() => setShowPaid((v) => !v)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "transparent",
                  border: "none",
                  color: "rgba(255,255,255,0.36)",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  padding: "4px 0",
                  width: "100%"
                }}
              >
                <ChevronDown size={13} style={{ transform: showPaid ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
                Já resolvido ({paidItems.length})
              </button>
              {showPaid && (
                <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                  {paidItems.map((item) => (
                    <PlanItemRow
                      key={item.id}
                      item={item}
                      readonly={readonly}
                      onStatusChange={onStatusChange}
                      onDelete={onDelete}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Recurring items management */}
      {!readonly && recurringItems.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <button
            onClick={() => setShowRecurring((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11.5,
              fontWeight: 600,
              color: "rgba(255,255,255,0.38)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0
            }}
          >
            <RefreshCw size={12} />
            {recurringItems.length} recorrência{recurringItems.length !== 1 ? "s" : ""} ativa{recurringItems.length !== 1 ? "s" : ""}
            <ChevronDown
              size={12}
              style={{ transform: showRecurring ? "rotate(180deg)" : "none", transition: "transform .2s" }}
            />
          </button>

          {showRecurring && (
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              {recurringItems.map((r) => {
                const isParcelada = r.recorrencia?.tipo === "parcelada";
                const parcelaAtualR = isParcelada && r.recorrencia?.mesInicio
                  ? calcMonthDiff(r.recorrencia.mesInicio, monthKey) + 1
                  : null;
                const totalMesesR = isParcelada ? r.recorrencia?.totalMeses ?? null : null;
                return (
                  <div
                    key={r.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: "7px 10px",
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)"
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.title}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>
                        dia {r.dueDay} · {formatCurrency(r.amount)}
                        {isParcelada && parcelaAtualR && totalMesesR
                          ? ` · ${parcelaAtualR}/${totalMesesR} parcelas`
                          : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <button
                        onClick={() => onEditRecurring(r)}
                        title="Editar recorrência"
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.10)",
                          borderRadius: 6,
                          color: "rgba(255,255,255,0.55)",
                          cursor: "pointer",
                          padding: "4px 8px",
                          fontSize: 11,
                          fontWeight: 600
                        }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => onDeactivateRecurring(r)}
                        title="Pausar recorrência"
                        style={{
                          background: "rgba(255,80,80,0.10)",
                          border: "1px solid rgba(255,80,80,0.18)",
                          borderRadius: 6,
                          color: "#ff8080",
                          cursor: "pointer",
                          padding: "4px 8px",
                          fontSize: 11,
                          fontWeight: 600
                        }}
                      >
                        Pausar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </WsCard>
  );
}

function PlanMetric({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "income" | "expense";
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.34)" }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 800, color: tone === "income" ? G : "#ff8080", whiteSpace: "nowrap" }}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}

function PlanItemRow({
  item,
  readonly,
  onStatusChange,
  onDelete
}: {
  item: PlannedItem;
  readonly: boolean;
  onStatusChange: (item: PlannedItem, status: PlannedItemStatus) => Promise<void>;
  onDelete: (item: PlannedItem) => Promise<void>;
}) {
  const isPaid = item.status === "paid";
  const color = item.type === "income" ? G : "#ff8080";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: readonly ? "1fr auto" : "1fr auto auto",
        gap: 8,
        alignItems: "center",
        padding: "9px 10px",
        borderRadius: 10,
        background: isPaid ? "rgba(184,245,90,0.06)" : "rgba(255,255,255,0.035)",
        border: `1px solid ${isPaid ? "rgba(184,245,90,0.14)" : "rgba(255,255,255,0.06)"}`
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {item.title}
          </p>
          {item.recurringId && (
            <span
              title="Recorrente"
              style={{ fontSize: 9, fontWeight: 700, color: G, background: "rgba(184,245,90,0.12)", borderRadius: 4, padding: "1px 4px", flexShrink: 0 }}
            >
              ∞
            </span>
          )}
        </div>
        <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.32)", marginTop: 2 }}>
          dia {String(item.dueDay).padStart(2, "0")} · {isPaid ? "pago" : "previsto"}
        </p>
      </div>
      <span style={{ fontSize: 12.5, fontWeight: 800, color, whiteSpace: "nowrap" }}>
        {item.type === "income" ? "+" : "-"}
        {formatCurrency(item.amount)}
      </span>
      {!readonly && (
        <div style={{ display: "flex", gap: 4 }}>
          <button
            title={isPaid ? "Marcar como previsto" : "Marcar como pago"}
            onClick={() => onStatusChange(item, isPaid ? "planned" : "paid")}
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              border: "1px solid rgba(255,255,255,0.10)",
              background: isPaid ? G : "rgba(255,255,255,0.05)",
              color: isPaid ? "#000" : "rgba(255,255,255,0.48)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Check size={13} />
          </button>
          <button
            title="Remover do plano"
            onClick={() => onDelete(item)}
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              border: "1px solid rgba(255,80,80,0.14)",
              background: "rgba(255,80,80,0.06)",
              color: "rgba(255,80,80,0.68)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Balance header ──────────────────────────────────────────────────────────

function MoMBadge({ current, prev, prevMonthKey, positiveWhenUp, hasData = true, prevLabel }: { current: number; prev: number; prevMonthKey: string; positiveWhenUp: boolean; hasData?: boolean; prevLabel?: string }) {
  if (!hasData) return null;
  const diff = current - prev;
  const pct = prev !== 0 ? (diff / Math.abs(prev)) * 100 : (diff !== 0 ? Infinity : 0);
  const isFlat = Math.abs(diff) < 0.01;
  const isUp = diff > 0;
  const color = isFlat ? "#facc15" : (positiveWhenUp ? isUp : !isUp) ? G : "#ff8080";
  const pctLabel = !isFlat && isFinite(pct) ? Math.abs(pct).toFixed(1) + "%" : "";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, color }}>
        {isFlat ? "—" : isUp ? "▲" : "▼"}{pctLabel ? " " + pctLabel : ""}
      </span>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
        vs {prevLabel ?? formatCurrency(prev)} {monthLabel(prevMonthKey)}
      </span>
    </div>
  );
}

function BalanceHeader({
  summary,
  showDemo,
  monthKey,
  prevMonthKey,
  prevExpense,
  prevIncome
}: {
  summary: ReturnType<typeof buildMonthlySummary>;
  showDemo: boolean;
  monthKey: string;
  prevMonthKey: string;
  prevExpense: number;
  prevIncome: number;
}) {
  const isPositive = summary.balance >= 0;
  const prevSavingsRate = prevIncome > 0 ? Math.round(((prevIncome - prevExpense) / prevIncome) * 100) : 0;

  return (
    <div
      className="ws-balance-card"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16,
        padding: "28px 32px",
        animation: "fadeUp .45s ease both"
      }}
    >
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.36)", fontWeight: 600, marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {showDemo ? "Demo — Abril 2026" : monthLabel(monthKey)}
      </p>
      <div className="ws-balance-row" style={{ display: "flex", alignItems: "flex-end", gap: 32, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginBottom: 4 }}>Saldo do mês</p>
          <p style={{ fontSize: "clamp(32px,5vw,56px)", fontWeight: 900, letterSpacing: "-0.04em", color: isPositive ? G : "#ff8080", lineHeight: 1 }}>
            {formatCurrency(summary.balance)}
          </p>
        </div>
        <div className="ws-balance-stats" style={{ display: "flex", gap: 28, paddingBottom: 4 }}>
          <div>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginBottom: 4 }}>Entradas</p>
            <p className="ws-stat-val" style={{ fontSize: 20, fontWeight: 800, color: G, letterSpacing: "-0.03em" }}>
              +{formatCurrency(summary.income)}
            </p>
            <MoMBadge current={summary.income} prev={prevIncome} prevMonthKey={prevMonthKey} positiveWhenUp={true} hasData={prevIncome > 0} />
          </div>
          <div>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginBottom: 4 }}>Saídas</p>
            <p className="ws-stat-val" style={{ fontSize: 20, fontWeight: 800, color: "#ff8080", letterSpacing: "-0.03em" }}>
              -{formatCurrency(summary.expense)}
            </p>
            <MoMBadge current={summary.expense} prev={prevExpense} prevMonthKey={prevMonthKey} positiveWhenUp={false} hasData={prevExpense > 0} />
            {summary.accountExpense > 0 && summary.cardExpense > 0 && (
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginTop: 4 }}>
                🏦 {formatCurrency(summary.accountExpense)} · 💳 {formatCurrency(summary.cardExpense)}
              </p>
            )}
          </div>
          {summary.savingsRate !== null && summary.savingsRate > 0 && (
            <div>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginBottom: 4 }}>Economia</p>
              <p className="ws-stat-val" style={{ fontSize: 20, fontWeight: 800, color: "rgba(255,255,255,0.7)", letterSpacing: "-0.03em" }}>
                {summary.savingsRate.toFixed(0)}%
              </p>
              <MoMBadge current={summary.savingsRate} prev={prevSavingsRate} prevMonthKey={prevMonthKey} positiveWhenUp={true} hasData={prevIncome > 0} prevLabel={prevSavingsRate + "%"} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Upload zone ─────────────────────────────────────────────────────────────

function UploadZone({
  onFiles,
  onAddManual,
}: {
  onFiles: (files: File[]) => void;
  onAddManual: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = ".pdf,.csv,.ofx,.qfx,image/*";

  const onDragOver = (e: DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(files);
  };
  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) onFiles(files);
    e.target.value = "";
  };

  return (
    <div>
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `1.5px dashed ${dragging ? G : "rgba(255,255,255,0.14)"}`,
          cursor: "pointer",
          borderRadius: 14,
          padding: "28px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          background: dragging
            ? "rgba(184,245,90,0.05)"
            : "rgba(255,255,255,0.018)",
          transition: "all .2s"
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: dragging ? "rgba(184,245,90,0.15)" : "rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all .2s"
          }}
        >
          <Upload size={18} color={dragging ? G : "rgba(255,255,255,0.5)"} />
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
            {dragging ? "Solte os arquivos aqui" : "Importar extrato"}
          </p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.36)" }}>
            Arraste ou clique para selecionar
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          {[
            { icon: <FileText size={13} />, label: "PDF" },
            { icon: <FileText size={13} />, label: "CSV" },
            { icon: <FileText size={13} />, label: "OFX" },
            { icon: <ImageIcon size={13} />, label: "Imagem" }
          ].map(({ icon, label }) => (
            <span
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 600,
                color: "rgba(255,255,255,0.38)",
                background: "rgba(255,255,255,0.06)",
                borderRadius: 6,
                padding: "3px 8px"
              }}
            >
              {icon} {label}
            </span>
          ))}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          style={{ display: "none" }}
          onChange={onPick}
        />
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAddManual();
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          fontWeight: 600,
          color: "rgba(255,255,255,0.36)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: "8px 0 0",
          transition: "color .18s"
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = G)}
        onMouseLeave={(e) =>
          (e.currentTarget.style.color = "rgba(255,255,255,0.36)")
        }
      >
        <Plus size={13} /> Adicionar manualmente
      </button>
    </div>
  );
}

// ─── Insights view ───────────────────────────────────────────────────────────


function InsightsView({
  transactions,
  prevTransactions,
  monthKey,
  workspaceId,
  renda,
  onRendaChange,
  aiDiag,
  diagLoading,
  diagError = false,
}: {
  transactions: Transaction[];
  prevTransactions: Transaction[];
  monthKey: string;
  workspaceId: string;
  renda: number;
  onRendaChange: (v: number) => void;
  aiDiag: DiagResult | null;
  diagLoading: boolean;
  diagError?: boolean;
}) {
  const router = useRouter();
  const [editingRenda, setEditingRenda] = useState(false);
  const [rendaText, setRendaText] = useState("");

  const expenses = transactions.filter((t) => t.type === "expense");
  const totalGasto = expenses.reduce((s, t) => s + t.amount, 0);
  const totalEntradas = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);

  const prevExpenses = prevTransactions.filter((t) => t.type === "expense");
  const prevTotalGasto = prevExpenses.reduce((s, t) => s + t.amount, 0);

  const prevMonthKey = useMemo(() => {
    const [y, m] = monthKey.split("-").map(Number);
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  }, [monthKey]);

  // Dias com gasto para média/dia
  const daysWithExpenses = useMemo(() => new Set(expenses.map((t) => t.date)).size, [expenses]);
  const mediaGastoPorDia = daysWithExpenses > 0 ? totalGasto / daysWithExpenses : 0;

  const rendaRef = renda > 0 ? renda : (totalEntradas > 0 ? totalEntradas : 1);
  const comprometimento = totalGasto > 0 ? Math.min(100, Math.round((totalGasto / rendaRef) * 100)) : 0;

  // ratio sem cap — score e comprometimento usam a mesma base para serem consistentes
  const ratio = totalGasto / rendaRef;

  const score = expenses.length === 0 ? null : (() => {
    if (ratio >= 2.0)  return 0;
    if (ratio >= 1.5)  return 1;
    if (ratio >= 1.0)  return 2.5;
    if (ratio >= 0.90) return 4.5;
    if (ratio >= 0.75) return 6.5;
    if (ratio >= 0.50) return 8.5;
    return 10;
  })();
  const scoreColor = score === null ? G : score >= 8 ? G : score >= 6 ? "#facc15" : "#ff8080";
  const scoreLabel = score === null ? "—" : score >= 8 ? "Arrasando 💪" : score >= 6 ? "Dá pra melhorar" : "Tá pesado.";

  const byDay = useMemo(() => {
    const m: Record<string, number> = {};
    for (const tx of expenses) m[tx.date] = (m[tx.date] ?? 0) + tx.amount;
    return m;
  }, [expenses]);

  const prevByDay = useMemo(() => {
    const m: Record<string, number> = {};
    for (const tx of prevExpenses) m[tx.date] = (m[tx.date] ?? 0) + tx.amount;
    return m;
  }, [prevExpenses]);

  const topDays = useMemo(() => {
    return Object.entries(byDay).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [byDay]);
  const maxDayAmount = topDays[0]?.[1] ?? 1;

  const byCategory = useMemo(() => {
    const m: Record<string, number> = {};
    for (const tx of expenses) m[tx.category] = (m[tx.category] ?? 0) + tx.amount;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const prevByCategory = useMemo(() => {
    const m: Record<string, number> = {};
    for (const tx of prevExpenses) m[tx.category] = (m[tx.category] ?? 0) + tx.amount;
    return m;
  }, [prevExpenses]);

  const subscriptions = useMemo(() => {
    const subs = transactions.filter((t) => t.category === "Assinaturas");
    const byDesc: Record<string, number> = {};
    for (const tx of subs) byDesc[tx.description] = (byDesc[tx.description] ?? 0) + tx.amount;
    return Object.entries(byDesc).sort((a, b) => b[1] - a[1]);
  }, [transactions]);

  const maxCategory = byCategory[0]?.[1] ?? 1;
  const expenseChange = prevTotalGasto > 0 ? Math.round(((totalGasto - prevTotalGasto) / prevTotalGasto) * 100) : null;
  const topCat = byCategory[0] ?? null;
  const net = totalEntradas - totalGasto;

  if (!expenses.length) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.24)", fontSize: 13 }}>
        Sem gastos em {monthLabel(monthKey)} para diagnosticar.
      </div>
    );
  }

  const INS_LABEL: CSSProperties = { fontSize: 11, color: "rgba(255,255,255,0.32)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10, fontWeight: 700 };
  const scoreRgb = scoreColor === G ? "184,245,90" : scoreColor === "#facc15" ? "250,204,21" : "255,128,128";

  const narrativa = (score ?? 0) >= 8
    ? `Fechou o mês no positivo em ${formatCurrency(net)}. Só ${comprometimento}% da renda foi embora — isso é disciplina de verdade.`
    : (score ?? 0) >= 6
    ? `Mês fechou ${net >= 0 ? "positivo" : "no vermelho"} em ${formatCurrency(Math.abs(net))}, mas ${comprometimento}% da renda já era. Dá pra apertar mais.`
    : `${comprometimento}% da renda foi embora esse mês. Sobrou ${formatCurrency(Math.abs(net))}${net < 0 ? " no negativo" : ""} — isso precisa mudar.`;
  const bullet1 = topCat ? `${topCat[0]} engoliu ${formatCurrency(topCat[1])} — ${Math.round((topCat[1] / totalGasto) * 100)}% de tudo que saiu` : null;
  const bullet2 = expenseChange !== null
    ? expenseChange > 100
      ? `Gastos explodiram ${Math.abs(expenseChange)}% vs mês passado — o que mudou?`
      : expenseChange > 0
      ? `Gastos ${Math.abs(expenseChange)}% maiores que o mês passado`
      : `Você cortou ${Math.abs(expenseChange)}% dos gastos vs mês passado — continua assim`
    : null;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Diagnóstico do mês — primeiro card */}
      <div className="ins-card" style={{ border: `1px solid rgba(${scoreRgb},0.18)`, background: `rgba(${scoreRgb},0.04)`, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -60, right: -60, width: 220, height: 220, borderRadius: "50%", background: `rgba(${scoreRgb},0.10)`, filter: "blur(55px)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 24, position: "relative" }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 10.5, color: `rgba(${scoreRgb},0.65)`, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              Diagnóstico do mês
              {diagLoading && <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: `rgba(${scoreRgb},0.5)`, animation: "pulse 1.2s ease-in-out infinite" }} />}
              {diagError && !diagLoading && !aiDiag && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>não carregou agora</span>}
            </p>
            <p style={{ fontSize: 28, fontWeight: 900, color: scoreColor, letterSpacing: "-0.03em", marginBottom: 10, lineHeight: 1.1 }}>
              {aiDiag?.scoreLabel ?? scoreLabel}
            </p>
            <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.42)", lineHeight: 1.65, marginBottom: (aiDiag?.bullet1 ?? bullet1) || (aiDiag?.bullet2 ?? bullet2) ? 10 : 0, transition: "opacity .4s", opacity: diagLoading ? 0.5 : 1 }}>
              {aiDiag?.narrativa ?? narrativa}
            </p>
            {((aiDiag?.bullet1 ?? bullet1) || (aiDiag?.bullet2 ?? bullet2)) && (
              <div style={{ display: "grid", gap: 5 }}>
                {(aiDiag?.bullet1 ?? bullet1) && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: `rgba(${scoreRgb},0.55)`, transition: "opacity .4s", opacity: diagLoading ? 0.5 : 1 }}>
                    <span style={{ flexShrink: 0, marginTop: 1 }}>↗</span>{aiDiag?.bullet1 ?? bullet1}
                  </div>
                )}
                {(aiDiag?.bullet2 ?? bullet2) && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: `rgba(${scoreRgb},0.55)`, transition: "opacity .4s", opacity: diagLoading ? 0.5 : 1 }}>
                    <span style={{ flexShrink: 0, marginTop: 1 }}>{expenseChange !== null && expenseChange < 0 ? "↘" : "↗"}</span>{aiDiag?.bullet2 ?? bullet2}
                  </div>
                )}
              </div>
            )}
          </div>
          <InsightScoreRing score={score} color={scoreColor} size={90} />
        </div>
      </div>

      {/* Métricas rápidas */}
      <div className="ins-metrics">
        {([
          { label: "Gastos no mês anterior", value: prevTotalGasto > 0 ? formatCurrency(prevTotalGasto) : "—", accent: false },
          { label: "Transações", value: String(expenses.length), accent: false },
          { label: "Média de gastos/dia", value: formatCurrency(mediaGastoPorDia), accent: false },
          { label: "% Renda comprometida", value: `${comprometimento}%`, accent: comprometimento > 75 }
        ] as { label: string; value: string; accent: boolean }[]).map(({ label, value, accent }) => (
          <div key={label} className={`ins-card${accent ? " ins-card-accent" : ""}`}>
            <p style={INS_LABEL}>{label}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: accent ? "#ff8080" : "#fff", letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Renda + barra comprometimento */}
      <div className="ins-card" style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
        <div style={{ minWidth: 160 }}>
          <p style={INS_LABEL}>Renda mensal</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {editingRenda ? (
              <input
                type="text" inputMode="numeric" autoFocus
                value={rendaText}
                placeholder="R$ 0,00"
                onChange={(e) => setRendaText(maskBRL(e.target.value))}
                onBlur={() => { onRendaChange(parseBRL(rendaText)); setEditingRenda(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, outline: "none", color: "#fff", fontSize: 18, fontWeight: 800, width: 140, letterSpacing: "-0.03em", padding: "4px 8px" }}
              />
            ) : (
              <span
                onClick={() => { setRendaText(renda > 0 ? maskBRL(String(renda * 100)) : ""); setEditingRenda(true); }}
                style={{ fontSize: 20, fontWeight: 800, color: renda > 0 ? "#fff" : "rgba(255,255,255,0.3)", letterSpacing: "-0.03em", cursor: "pointer" }}
              >
                {renda > 0 ? formatCurrency(renda) : "Declarar renda"}
              </span>
            )}
            {!editingRenda && (
              <button onClick={() => { setRendaText(renda > 0 ? maskBRL(String(renda * 100)) : ""); setEditingRenda(true); }} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", padding: 2, display: "flex", alignItems: "center" }}>
                <Pencil size={13} />
              </button>
            )}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{formatCurrency(totalGasto)} gastos</span>
            <span style={{ fontSize: 11, color: comprometimento > 75 ? "#ff8080" : "rgba(255,255,255,0.3)", fontWeight: 700 }}>{comprometimento}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 3, width: `${Math.min(100, comprometimento)}%`, background: comprometimento > 90 ? "#ff8080" : comprometimento > 75 ? "#facc15" : G, transition: "width .5s cubic-bezier(.4,0,.2,1), background .4s" }} />
          </div>
        </div>
      </div>

      {/* Gastos por dia */}
      <div className="ins-card">
        <p style={INS_LABEL}>Gastos por dia</p>
        <div style={{ width: "100%", minWidth: 0 }}>
          <DailySpendChart byDay={byDay} monthKey={monthKey} prevByDay={prevByDay} prevMonthKey={prevMonthKey} />
        </div>
      </div>

      {/* Top 3 Categorias + Assinaturas */}
      <div className="ins-2col">
        <div className="ins-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <p style={{ ...INS_LABEL, marginBottom: 0 }}>Top categorias</p>
            <button
              onClick={() => { localStorage.setItem("fincheck_workspace", workspaceId); router.push(`/top-categories?month=${monthKey}`); }}
              style={{ fontSize: 11, fontWeight: 600, color: G, background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, opacity: 0.8 }}
            >
              Ver tudo <ArrowRight size={11} />
            </button>
          </div>
          <TopCategoriesChart
            byCategory={byCategory}
            maxCategory={maxCategory}
            totalGasto={totalGasto}
            prevByCategory={prevByCategory}
          />
        </div>

        <div className="ins-card">
          <p style={INS_LABEL}>Assinaturas detectadas</p>
          {subscriptions.length === 0 ? (
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", lineHeight: 1.6 }}>
              Nenhuma assinatura encontrada neste mês.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 9 }}>
              {subscriptions.map(([desc, total]) => (
                <div key={desc} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{desc}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", flexShrink: 0 }}>{formatCurrency(total)}</span>
                </div>
              ))}
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "2px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Total mensal</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#ff8080" }}>{formatCurrency(subscriptions.reduce((s, [, v]) => s + v, 0))}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── DailySpendChart ──────────────────────────────────────────────────────────

const PT_MONTHS_SHORT = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

interface DailyPoint { key: string; label: string; day: number; value: number }

function buildMonthData(monthKey: string, byDay: Record<string, number>): DailyPoint[] {
  const [year, month] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  const lastDay = isCurrentMonth ? today.getDate() : daysInMonth;
  return Array.from({ length: lastDay }, (_, i) => {
    const day = i + 1;
    const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return { key, label: `${String(day).padStart(2, "0")} ${PT_MONTHS_SHORT[month - 1]}`, day, value: byDay[key] ?? 0 };
  });
}

function DailyTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: DailyPoint }> }) {
  if (!active || !payload?.length) return null;
  const pt = payload[0].payload;
  return (
    <div style={{ background: "#1a1a1a", border: "1px solid rgba(184,245,90,0.3)", borderRadius: 8, padding: "6px 10px", fontSize: 12, pointerEvents: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}>
      <p style={{ color: "rgba(255,255,255,0.45)", marginBottom: 2 }}>{pt.label}</p>
      <p style={{ fontWeight: 700, color: pt.value > 0 ? G : "rgba(255,255,255,0.3)" }}>
        {pt.value > 0 ? formatCurrency(pt.value) : "Nenhum gasto"}
      </p>
    </div>
  );
}

function DailySpendChart({
  byDay, monthKey, prevByDay, prevMonthKey
}: {
  byDay: Record<string, number>; monthKey: string;
  prevByDay: Record<string, number>; prevMonthKey: string;
}) {
  const data = useMemo(() => buildMonthData(monthKey, byDay), [monthKey, byDay]);

  // Merge prev month values into each data point so both series share the same
  // x-axis (categorical by label), avoiding cross-month label misalignment.
  const prevData = useMemo(() => {
    const full = buildMonthData(prevMonthKey, prevByDay);
    return data.map((pt, i) => ({ ...pt, prevValue: full[i]?.value ?? 0 }));
  }, [data, prevMonthKey, prevByDay]);

  const lastWithData = useMemo(() => [...data].reverse().find(d => d.value > 0), [data]);

  return (
    <>
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={prevData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id="dailyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(184,245,90,0.25)" />
              <stop offset="100%" stopColor="rgba(184,245,90,0)" />
            </linearGradient>
          </defs>
          <CartesianGrid horizontal={true} vertical={false} stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="label"
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${Math.round(v)}`}
            width={40}
          />
          <Tooltip
            content={(props) => <DailyTooltip active={props.active} payload={props.payload as unknown as Array<{ payload: DailyPoint }>} />}
            cursor={{ stroke: "rgba(184,245,90,0.2)", strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={G}
            strokeWidth={2}
            fill="url(#dailyGradient)"
            dot={false}
            activeDot={{ r: 4, fill: G, stroke: "#fff", strokeWidth: 2 }}
            animationDuration={1000}
            animationEasing="ease-out"
            isAnimationActive={true}
          />
          <Line
            type="monotone"
            dataKey="prevValue"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
          {lastWithData && (
            <ReferenceDot
              x={lastWithData.label}
              y={lastWithData.value}
              r={5}
              fill={G}
              stroke="#fff"
              strokeWidth={2}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", gap: 16, marginTop: 4, fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 16, height: 2, background: G, borderRadius: 1, display: "inline-block" }} />
          Este mês
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 16, height: 2, background: "rgba(255,255,255,0.25)", borderRadius: 1, display: "inline-block" }} />
          Mês passado
        </span>
      </div>
    </>
  );
}

// ─── TopCategoriesChart ───────────────────────────────────────────────────────

function TopCategoriesChart({
  byCategory,
  maxCategory,
  totalGasto,
  prevByCategory
}: {
  byCategory: [string, number][];
  maxCategory: number;
  totalGasto: number;
  prevByCategory: Record<string, number>;
}) {
  const [mounted, setMounted] = useState(false);
  const [hovCat, setHovCat] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ display: "grid", gap: 4 }}>
      {byCategory.slice(0, 3).map(([cat, total]) => {
        const color = CATEGORY_COLORS[cat] ?? "#888";
        const pct = totalGasto > 0 ? Math.round((total / totalGasto) * 100) : 0;
        const barW = mounted ? Math.round((total / maxCategory) * 100) : 0;
        const prev = prevByCategory[cat] ?? 0;
        const changePct = prev > 0 ? ((total - prev) / prev) * 100 : null;
        const isHov = hovCat === cat;
        const label = CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat;

        return (
          <div
            key={cat}
            onMouseEnter={() => setHovCat(cat)}
            onMouseLeave={() => setHovCat(null)}
            style={{
              padding: "8px 10px", borderRadius: 8,
              background: isHov ? "rgba(255,255,255,0.04)" : "transparent",
              transition: "background .15s", position: "relative"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <CategoryAvatar categoria={cat} size={28} radius={8} />
              <span style={{
                flex: 1, fontSize: 13, fontWeight: 700, color: "#e8e9ec",
                minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
              }}>
                {label}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: "#fff" }}>{formatCurrency(total)}</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{pct}%</span>
              </div>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)", overflow: "hidden", marginLeft: 38 }}>
              <div style={{
                height: "100%", borderRadius: 2,
                width: `${barW}%`,
                background: color,
                boxShadow: `0 0 8px ${color}55`,
                transition: "width 800ms ease-out"
              }} />
            </div>
            {isHov && changePct !== null && (
              <div style={{
                position: "absolute", right: 10, top: -30, zIndex: 20,
                background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, padding: "4px 10px",
                fontSize: 11.5, fontWeight: 700, pointerEvents: "none",
                color: changePct < 0 ? G : "#ff8080", whiteSpace: "nowrap",
                boxShadow: "0 4px 16px rgba(0,0,0,0.5)"
              }}>
                {changePct < 0 ? "▼" : "▲"} {Math.abs(changePct).toFixed(0)}% vs mês anterior
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── InsightScoreRing ─────────────────────────────────────────────────────────

function InsightScoreRing({ score, color }: { score: number | null; color: string; size?: number }) {
  return (
    <div style={{ flexShrink: 0, textAlign: "right" }}>
      <span style={{ fontSize: 52, fontWeight: 900, color, letterSpacing: "-0.04em", lineHeight: 1, display: "block", textShadow: `0 0 32px ${color}66` }}>
        {score !== null ? score.toFixed(1).replace(".", ",") : "—"}
      </span>
      <span style={{ fontSize: 10, color: `${color}88`, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>
        / nota
      </span>
    </div>
  );
}

// ─── Transaction row ──────────────────────────────────────────────────────────

function TxRow({
  tx,
  readonly,
  onDelete
}: {
  tx: Transaction;
  readonly: boolean;
  onDelete: () => void;
}) {
  const [hov, setHov] = useState(false);
  const isIncome = tx.type === "income";
  const parts = tx.date.split("-");
  const dateLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}` : tx.date;

  return (
    <div
      className="ws-tx-row"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "8px 1fr auto auto",
        gap: "0 14px",
        alignItems: "center",
        padding: "10px 12px",
        borderRadius: 10,
        transition: "background .15s"
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: categoryColor(tx.category),
          boxShadow: `0 0 8px ${categoryColor(tx.category)}66`,
          flexShrink: 0
        }}
      />
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: "#e8e9ec",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          }}
        >
          {tx.description}
        </p>
        <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.32)", marginTop: 1 }}>
          {CATEGORY_LABELS[tx.category as keyof typeof CATEGORY_LABELS] ?? tx.category} · {dateLabel}
        </p>
      </div>
      <span
        style={{
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: isIncome ? G : "#ff8080",
          whiteSpace: "nowrap"
        }}
      >
        {isIncome ? "+" : "-"}
        {formatCurrency(tx.amount)}
      </span>
      {!readonly && (
        <button
          onClick={onDelete}
          style={{
            opacity: hov ? 1 : 0,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "rgba(255,80,80,0.65)",
            padding: 4,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            transition: "opacity .15s"
          }}
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

// ─── Import modal ─────────────────────────────────────────────────────────────

function ImportModal({
  state,
  onCancel,
  onConfirm,
  onToggle,
  onCategoryChange
}: {
  state: ImportState;
  onCancel: () => void;
  onConfirm: (rows: ParsedWithMeta[]) => void;
  onToggle: (id: string) => void;
  onCategoryChange: (id: string, cat: string) => void;
}) {
  const isParsing = state.phase === "parsing";
  const isBackground = state.phase === "background";
  const isSaving = state.phase === "saving";
  const rows = state.phase === "preview" || state.phase === "saving" ? state.rows : [];
  const selectedCount = rows.filter((r) => r.selected).length;
  const error = state.phase === "preview" ? state.error : undefined;

  const categoriesFor = (type: "income" | "expense") => {
    if (type === "income") return [...CATEGORIES].sort();
    const sorted = CATEGORIES.filter((c) => c !== "Recebimentos" && c !== "Outros").sort();
    return [...sorted, "Outros"];
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(8px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24
      }}
      onClick={(e) => e.target === e.currentTarget && !isSaving && onCancel()}
    >
      <div
        style={{
          background: "#0e0f11",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 18,
          width: "100%",
          maxWidth: 680,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 40px 100px rgba(0,0,0,0.6)"
        }}
      >
        {/* Modal header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.07)"
          }}
        >
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>
              {isParsing
                ? "Lendo arquivo..."
                : isBackground
                ? "Analisando extrato..."
                : isSaving
                ? "Salvando..."
                : "Revisar importação"}
            </h2>
            {!isParsing && !isBackground && !isSaving && (
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", marginTop: 3 }}>
                {selectedCount} de {rows.length} transações selecionadas
              </p>
            )}
          </div>
          {!isSaving && (
            <button
              onClick={onCancel}
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "none",
                borderRadius: 8,
                color: "rgba(255,255,255,0.55)",
                cursor: "pointer",
                padding: "6px 8px",
                display: "flex"
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Modal body */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 24px" }}>
          {isParsing || isBackground || isSaving ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 14,
                padding: "48px 0"
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  border: "3px solid rgba(184,245,90,0.2)",
                  borderTopColor: G,
                  borderRadius: "50%",
                  animation: "spin .8s linear infinite"
                }}
              />
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
                {isParsing
                  ? "Extraindo transações com IA..."
                  : isBackground
                  ? "Processando em segundo plano..."
                  : "Salvando lançamentos..."}
              </p>
              {isBackground && (
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: -6 }}>
                  Pode levar até 1 minuto para extratos grandes.
                </p>
              )}
            </div>
          ) : (
            <>
              {error && (
                <div
                  style={{
                    background: "rgba(255,80,80,0.1)",
                    border: "1px solid rgba(255,80,80,0.25)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    fontSize: 12.5,
                    color: "#ff8080",
                    marginBottom: 14
                  }}
                >
                  {error}
                </div>
              )}
              {rows.length === 0 ? (
                <p
                  style={{
                    textAlign: "center",
                    padding: "40px 0",
                    color: "rgba(255,255,255,0.28)",
                    fontSize: 13
                  }}
                >
                  Nenhuma transação encontrada no arquivo.
                </p>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {/* Header */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "28px 1fr 140px 110px",
                      gap: 10,
                      padding: "4px 8px",
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.28)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em"
                    }}
                  >
                    <span />
                    <span>Descrição</span>
                    <span>Categoria</span>
                    <span style={{ textAlign: "right" }}>Valor</span>
                  </div>
                  {rows.map((row) => (
                    <div
                      key={row._id}
                      onClick={() => onToggle(row._id)}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "28px 1fr 140px 110px",
                        gap: 10,
                        alignItems: "center",
                        padding: "10px 8px",
                        borderRadius: 10,
                        background: row.selected
                          ? "rgba(255,255,255,0.04)"
                          : "transparent",
                        opacity: row.selected ? 1 : 0.38,
                        cursor: "pointer",
                        transition: "all .15s",
                        border: `1px solid ${row.selected ? "rgba(255,255,255,0.07)" : "transparent"}`
                      }}
                    >
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 5,
                          border: `1.5px solid ${row.selected ? G : "rgba(255,255,255,0.22)"}`,
                          background: row.selected ? G : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          transition: "all .15s"
                        }}
                      >
                        {row.selected && <Check size={11} color="#000" strokeWidth={3} />}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#e8e9ec",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis"
                          }}
                        >
                          {row.description}
                        </p>
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                          {row.date}
                        </p>
                      </div>
                      <select
                        value={row.category}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          onCategoryChange(row._id, e.target.value);
                        }}
                        style={{
                          fontSize: 12,
                          background: `${categoryColor(row.category)}18`,
                          border: `1px solid ${categoryColor(row.category)}44`,
                          borderRadius: 6,
                          color: categoryColor(row.category),
                          padding: "4px 8px",
                          cursor: "pointer",
                          fontWeight: 600
                        }}
                      >
                        {categoriesFor(row.type).map((c) => (
                          <option key={c} value={c} style={{ background: "#111", color: "#fff" }}>
                            {CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS] ?? c}
                          </option>
                        ))}
                      </select>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: row.type === "income" ? G : "#ff8080",
                          textAlign: "right",
                          letterSpacing: "-0.02em"
                        }}
                      >
                        {row.type === "income" ? "+" : "-"}
                        {formatCurrency(row.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal footer */}
        {!isParsing && !isBackground && !isSaving && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 10,
              padding: "16px 24px",
              borderTop: "1px solid rgba(255,255,255,0.07)"
            }}
          >
            <button
              onClick={onCancel}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "rgba(255,255,255,0.45)",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8,
                padding: "10px 18px",
                cursor: "pointer"
              }}
            >
              Cancelar
            </button>
            <button
              onClick={() => onConfirm(rows)}
              disabled={selectedCount === 0}
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "#000",
                background: selectedCount === 0 ? "rgba(184,245,90,0.35)" : G,
                border: "none",
                borderRadius: 8,
                padding: "10px 22px",
                cursor: selectedCount === 0 ? "not-allowed" : "pointer",
                transition: "all .18s"
              }}
            >
              Importar {selectedCount} lançamento{selectedCount !== 1 ? "s" : ""}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add transaction modal ────────────────────────────────────────────────────

function AddTransactionModal({
  user,
  profile,
  workspaceId,
  monthKey,
  onClose,
  onCreated
}: {
  user: User;
  profile: Profile;
  workspaceId: string;
  monthKey: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [type, setType] = useState<TransactionType>("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Alimentacao");
  const [date, setDate] = useState(`${monthKey}-01`);
  const [busy, setBusy] = useState(false);
  const expenseCategories = CATEGORIES.filter((c) => c !== "Recebimentos" && c !== "Outros").sort();
  const categories = type === "income" ? ["Recebimentos"] : [...expenseCategories, "Outros"];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await addDoc(collection(db, "workspaces", workspaceId, "transactions"), {
        type,
        description,
        amount: parseBRL(amount),
        category,
        date,
        monthKey,
        createdBy: user.uid,
        createdByName: profile.displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(8px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#0e0f11",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 18,
          width: "100%",
          maxWidth: 440,
          boxShadow: "0 40px 100px rgba(0,0,0,0.6)"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.07)"
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Adicionar lançamento</h2>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "none",
              borderRadius: 8,
              color: "rgba(255,255,255,0.55)",
              cursor: "pointer",
              padding: "6px 8px",
              display: "flex"
            }}
          >
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit} style={{ padding: 24, display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <select
              value={type}
              onChange={(e) => {
                const t = e.target.value as TransactionType;
                setType(t);
                setCategory(t === "income" ? "Recebimentos" : "Alimentacao");
              }}
              style={selectStyle}
            >
              <option value="expense">Saída</option>
              <option value="income">Entrada</option>
            </select>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Valor (R$)"
              value={amount}
              onChange={(e) => setAmount(maskBRL(e.target.value))}
              required
              style={inputStyle}
            />
          </div>
          <input
            placeholder="Descrição"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            style={inputStyle}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={selectStyle}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS] ?? c}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              style={inputStyle}
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              fontWeight: 800,
              fontSize: 14,
              color: "#000",
              background: G,
              border: "none",
              borderRadius: 10,
              padding: "13px 0",
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.7 : 1,
              transition: "all .18s"
            }}
          >
            {busy ? (
              <div
                style={{
                  width: 16,
                  height: 16,
                  border: "2.5px solid rgba(0,0,0,0.3)",
                  borderTopColor: "#000",
                  borderRadius: "50%",
                  animation: "spin .7s linear infinite"
                }}
              />
            ) : (
              <>
                <Plus size={16} /> Adicionar
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Month diff helper ────────────────────────────────────────────────────────

function calcMonthDiff(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

// ─── Edit recurring modal ─────────────────────────────────────────────────────

function EditRecurringModal({
  item,
  monthKey,
  workspaceId,
  onClose,
  onSaved
}: {
  item: RecurringItem;
  monthKey: string;
  workspaceId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [amount, setAmount] = useState(String(item.amount));
  const [category, setCategory] = useState(item.category);
  const [recurringMode, setRecurringMode] = useState<"infinita" | "parcelada">(
    item.recorrencia?.tipo ?? "infinita"
  );
  const [totalMeses, setTotalMeses] = useState(
    item.recorrencia?.totalMeses ? String(item.recorrencia.totalMeses) : ""
  );
  const [busy, setBusy] = useState(false);
  const expenseCategories = CATEGORIES.filter((c) => c !== "Recebimentos" && c !== "Outros").sort();
  const categories = item.type === "income" ? ["Recebimentos"] : [...expenseCategories, "Outros"];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      let mesInicio: string;
      if (recurringMode === "infinita") {
        mesInicio = item.recorrencia?.mesInicio ?? monthKey;
      } else if (item.recorrencia?.tipo === "parcelada") {
        // Editing parcelas of existing parcelada: keep original mesInicio
        mesInicio = item.recorrencia.mesInicio;
      } else {
        // Switching from infinita → parcelada: mesInicio = now
        mesInicio = monthKey;
      }
      await updateDoc(doc(db, "workspaces", workspaceId, "recurringItems", item.id), {
        title,
        amount: Number(amount),
        category,
        recorrencia: {
          tipo: recurringMode,
          totalMeses: recurringMode === "parcelada" ? Number(totalMeses) : null,
          mesInicio,
        },
        updatedAt: serverTimestamp(),
      });
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(8px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#0e0f11",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 18,
          width: "100%",
          maxWidth: 440,
          boxShadow: "0 40px 100px rgba(0,0,0,0.6)"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.07)"
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Editar recorrência</h2>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "none",
              borderRadius: 8,
              color: "rgba(255,255,255,0.55)",
              cursor: "pointer",
              padding: "6px 8px",
              display: "flex"
            }}
          >
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit} style={{ padding: 24, display: "grid", gap: 14 }}>
          <input
            placeholder="Nome"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Valor"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            style={inputStyle}
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={inputStyle}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS] ?? c}
              </option>
            ))}
          </select>
          {/* Recorrência mode */}
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.55)" }}>
              Recorrência
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {(["infinita", "parcelada"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setRecurringMode(mode)}
                  style={{
                    flex: 1,
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "7px 0",
                    borderRadius: 8,
                    border: `1px solid ${recurringMode === mode ? "rgba(184,245,90,0.35)" : "rgba(255,255,255,0.09)"}`,
                    background: recurringMode === mode ? "rgba(184,245,90,0.10)" : "rgba(255,255,255,0.03)",
                    color: recurringMode === mode ? G : "rgba(255,255,255,0.45)",
                    cursor: "pointer",
                    transition: "all .15s"
                  }}
                >
                  {mode === "infinita" ? "Todo mês" : "Por X meses"}
                </button>
              ))}
            </div>
            {recurringMode === "parcelada" && (
              <input
                type="number"
                min="2"
                max="360"
                placeholder="Número de parcelas. Ex: 12, 24, 48"
                value={totalMeses}
                onChange={(e) => setTotalMeses(e.target.value)}
                required
                style={inputStyle}
              />
            )}
          </div>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: -4 }}>
            A alteração vale a partir do mês atual. Meses já gerados não são afetados.
          </p>
          <button
            type="submit"
            disabled={busy}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              fontWeight: 800,
              fontSize: 14,
              color: "#000",
              background: G,
              border: "none",
              borderRadius: 10,
              padding: "13px 0",
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.7 : 1
            }}
          >
            {busy ? (
              <div
                style={{
                  width: 16,
                  height: 16,
                  border: "2.5px solid rgba(0,0,0,0.3)",
                  borderTopColor: "#000",
                  borderRadius: "50%",
                  animation: "spin .7s linear infinite"
                }}
              />
            ) : (
              "Salvar alterações"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Add planned item modal ──────────────────────────────────────────────────

function AddPlannedItemModal({
  user,
  profile,
  workspaceId,
  monthKey,
  onClose,
  onCreated
}: {
  user: User;
  profile: Profile;
  workspaceId: string;
  monthKey: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [type, setType] = useState<TransactionType>("expense");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Moradia");
  const [dueDay, setDueDay] = useState("10");
  const [recurring, setRecurring] = useState(false);
  const [recurringMode, setRecurringMode] = useState<"infinita" | "parcelada">("infinita");
  const [totalMeses, setTotalMeses] = useState("");
  const [busy, setBusy] = useState(false);
  const expenseCategories = CATEGORIES.filter((c) => c !== "Recebimentos" && c !== "Outros").sort();
  const categories = type === "income" ? ["Recebimentos"] : [...expenseCategories, "Outros"];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const safeDay = Math.min(31, Math.max(1, Number(dueDay)));
      let recurringId: string | undefined;

      if (recurring) {
        const rRef = await addDoc(collection(db, "workspaces", workspaceId, "recurringItems"), {
          type,
          title,
          amount: Number(amount),
          category,
          dueDay: safeDay,
          active: true,
          createdBy: user.uid,
          createdByName: profile.displayName,
          recorrencia: {
            tipo: recurringMode,
            totalMeses: recurringMode === "parcelada" ? Number(totalMeses) : null,
            mesInicio: monthKey,
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        recurringId = rRef.id;
      }

      // Use deterministic ID when recurring so auto-gen won't create a duplicate
      const plannedData = {
        type,
        title,
        amount: Number(amount),
        category,
        dueDay: safeDay,
        monthKey,
        status: "planned",
        createdBy: user.uid,
        createdByName: profile.displayName,
        ...(recurringId ? { recurringId } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (recurringId) {
        await setDoc(
          doc(db, "workspaces", workspaceId, "plannedItems", `${recurringId}_${monthKey}`),
          plannedData
        );
      } else {
        await addDoc(collection(db, "workspaces", workspaceId, "plannedItems"), plannedData);
      }

      onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(8px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#0e0f11",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 18,
          width: "100%",
          maxWidth: 440,
          boxShadow: "0 40px 100px rgba(0,0,0,0.6)"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.07)"
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Adicionar ao plano</h2>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "none",
              borderRadius: 8,
              color: "rgba(255,255,255,0.55)",
              cursor: "pointer",
              padding: "6px 8px",
              display: "flex"
            }}
          >
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit} style={{ padding: 24, display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <select
              value={type}
              onChange={(e) => {
                const nextType = e.target.value as TransactionType;
                setType(nextType);
                setCategory(nextType === "income" ? "Recebimentos" : "Moradia");
              }}
              style={inputStyle}
            >
              <option value="expense">Conta a pagar</option>
              <option value="income">Dinheiro a entrar</option>
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Valor previsto"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              style={inputStyle}
            />
          </div>
          <input
            placeholder="Nome. Ex: Aluguel, Salario, Cartao"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={inputStyle}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 12 }}>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={inputStyle}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS] ?? c}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              max="31"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              required
              style={inputStyle}
            />
          </div>
          {/* Recurring toggle */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              userSelect: "none",
              padding: "10px 12px",
              borderRadius: 10,
              background: recurring ? "rgba(184,245,90,0.07)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${recurring ? "rgba(184,245,90,0.22)" : "rgba(255,255,255,0.07)"}`,
              transition: "all .2s"
            }}
          >
            <div
              style={{
                width: 36,
                height: 20,
                borderRadius: 10,
                background: recurring ? G : "rgba(255,255,255,0.14)",
                position: "relative",
                transition: "background .2s",
                flexShrink: 0
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 3,
                  left: recurring ? 19 : 3,
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: recurring ? "#000" : "rgba(255,255,255,0.7)",
                  transition: "left .2s"
                }}
              />
            </div>
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => {
                setRecurring(e.target.checked);
                if (!e.target.checked) setRecurringMode("infinita");
              }}
              style={{ display: "none" }}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Repetir</div>
              <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.38)", marginTop: 1 }}>
                Lança automaticamente nos próximos meses
              </div>
            </div>
          </label>

          {recurring && (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", gap: 6 }}>
                {(["infinita", "parcelada"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setRecurringMode(mode)}
                    style={{
                      flex: 1,
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "7px 0",
                      borderRadius: 8,
                      border: `1px solid ${recurringMode === mode ? "rgba(184,245,90,0.35)" : "rgba(255,255,255,0.09)"}`,
                      background: recurringMode === mode ? "rgba(184,245,90,0.10)" : "rgba(255,255,255,0.03)",
                      color: recurringMode === mode ? G : "rgba(255,255,255,0.45)",
                      cursor: "pointer",
                      transition: "all .15s"
                    }}
                  >
                    {mode === "infinita" ? "Todo mês" : "Por X meses"}
                  </button>
                ))}
              </div>
              {recurringMode === "parcelada" && (
                <input
                  type="number"
                  min="2"
                  max="360"
                  placeholder="Número de parcelas. Ex: 12, 24, 48"
                  value={totalMeses}
                  onChange={(e) => setTotalMeses(e.target.value)}
                  required
                  style={inputStyle}
                />
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              fontWeight: 800,
              fontSize: 14,
              color: "#000",
              background: G,
              border: "none",
              borderRadius: 10,
              padding: "13px 0",
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.7 : 1
            }}
          >
            {busy ? (
              <div
                style={{
                  width: 16,
                  height: 16,
                  border: "2.5px solid rgba(0,0,0,0.3)",
                  borderTopColor: "#000",
                  borderRadius: "50%",
                  animation: "spin .7s linear infinite"
                }}
              />
            ) : (
              <>
                <Plus size={16} /> Adicionar ao plano
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Reconcile modal ─────────────────────────────────────────────────────────

function ReconcileModal({
  items,
  onChange,
  onClose,
  onConfirm
}: {
  items: { sourceLabel: string; monthKey: string; amount: number; include: boolean }[];
  onChange: (items: { sourceLabel: string; monthKey: string; amount: number; include: boolean }[]) => void;
  onClose: () => void;
  onConfirm: (items: { sourceLabel: string; monthKey: string; amount: number; include: boolean }[]) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(8px)", zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "#0e0f11", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 18, width: "100%", maxWidth: 420,
        boxShadow: "0 40px 100px rgba(0,0,0,0.6)"
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.07)"
        }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>Adicionar fatura ao Plano do mês?</h2>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", marginTop: 3 }}>
              Pra você marcar quando pagar o cartão
            </p>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 8,
            color: "rgba(255,255,255,0.55)", cursor: "pointer", padding: "6px 8px", display: "flex"
          }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "16px 24px", display: "grid", gap: 10 }}>
          {items.map((item, i) => (
            <label key={i} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: 12, padding: "12px 14px", borderRadius: 12, cursor: "pointer",
              background: item.include ? "rgba(184,245,90,0.06)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${item.include ? "rgba(184,245,90,0.18)" : "rgba(255,255,255,0.07)"}`,
              transition: "all .15s"
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Cartão {item.sourceLabel}</div>
                <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.38)", marginTop: 2 }}>
                  {monthLabel(item.monthKey)} · {formatCurrency(item.amount)}
                </div>
              </div>
              <div style={{
                width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                background: item.include ? G : "rgba(255,255,255,0.08)",
                border: `1.5px solid ${item.include ? G : "rgba(255,255,255,0.18)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all .15s"
              }}>
                {item.include && <Check size={12} color="#000" strokeWidth={3} />}
              </div>
              <input type="checkbox" checked={item.include} style={{ display: "none" }}
                onChange={(e) => onChange(items.map((it, j) => j === i ? { ...it, include: e.target.checked } : it))}
              />
            </label>
          ))}
        </div>

        <div style={{ padding: "0 24px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button onClick={onClose} style={{
            padding: "11px 0", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)",
            background: "transparent", color: "rgba(255,255,255,0.55)", fontSize: 13,
            fontWeight: 600, cursor: "pointer"
          }}>
            Agora não
          </button>
          <button
            disabled={busy || items.every((i) => !i.include)}
            onClick={async () => { setBusy(true); await onConfirm(items); }}
            style={{
              padding: "11px 0", borderRadius: 10, border: "none",
              background: items.every((i) => !i.include) ? "rgba(255,255,255,0.08)" : G,
              color: items.every((i) => !i.include) ? "rgba(255,255,255,0.3)" : "#000",
              fontSize: 13, fontWeight: 800, cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.7 : 1
            }}
          >
            {busy ? "Salvando..." : "Adicionar ao plano"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({
  workspace,
  member,
  isOwner,
  onClose,
  onDelete,
  onLeave
}: {
  workspace: Workspace;
  member: Member;
  isOwner: boolean;
  onClose: () => void;
  onDelete: () => Promise<void>;
  onLeave: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(8px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#0e0f11",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 18,
          width: "100%",
          maxWidth: 400,
          boxShadow: "0 40px 100px rgba(0,0,0,0.6)"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.07)"
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Configurações do workspace</h2>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "none",
              borderRadius: 8,
              color: "rgba(255,255,255,0.55)",
              cursor: "pointer",
              padding: "6px 8px",
              display: "flex"
            }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: "20px 24px", display: "grid", gap: 20 }}>
          <div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", marginBottom: 4 }}>
              Workspace
            </p>
            <p style={{ fontSize: 15, fontWeight: 700 }}>{workspace.name}</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", marginTop: 2 }}>
              Seu papel: {member.role === "owner" ? "Owner" : "Editor"}
            </p>
          </div>
          <div
            style={{
              borderTop: "1px solid rgba(255,255,255,0.07)",
              paddingTop: 20,
              display: "grid",
              gap: 10
            }}
          >
            {isOwner ? (
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await onDelete();
                  setBusy(false);
                  onClose();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  fontWeight: 700,
                  fontSize: 13,
                  color: "#fff",
                  background: "rgba(255,80,80,0.15)",
                  border: "1px solid rgba(255,80,80,0.25)",
                  borderRadius: 8,
                  padding: "11px 0",
                  cursor: "pointer"
                }}
              >
                <Trash2 size={14} /> Excluir workspace
              </button>
            ) : (
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await onLeave();
                  setBusy(false);
                  onClose();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  fontWeight: 700,
                  fontSize: 13,
                  color: "rgba(255,255,255,0.65)",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8,
                  padding: "11px 0",
                  cursor: "pointer"
                }}
              >
                Sair do workspace
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shared UI helpers ───────────────────────────────────────────────────────

const inputStyle: CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#fff",
  fontSize: 13,
  padding: "11px 13px",
  colorScheme: "dark"
};

const selectStyle: CSSProperties = {
  ...inputStyle,
  background: "#0e0f11",
};

function WsCard({
  children,
  style = {}
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14,
        padding: "20px 22px",
        ...style
      }}
    >
      {children}
    </div>
  );
}

function IconBtn({
  icon,
  label,
  onClick,
  className: extraClass
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      className={`ws-icon-btn${extraClass ? ` ${extraClass}` : ""}`}
      onClick={onClick}
      title={label}
      style={{
        width: 34,
        height: 34,
        borderRadius: 8,
        background: "transparent",
        border: "1px solid rgba(255,255,255,0.1)",
        color: "rgba(255,255,255,0.5)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all .18s"
      }}
    >
      {icon}
    </button>
  );
}

// ─── Brand icons ─────────────────────────────────────────────────────────────

function WhatsAppIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="#25D366">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

function GmailIcon() {
  return (
    <svg width="16" height="12" viewBox="0 0 24 18">
      <path fill="#4285F4" d="M0 16.5V1.5L12 9z"/>
      <path fill="#34A853" d="M24 16.5V1.5L12 9z"/>
      <path fill="#FBBC05" d="M0 1.5l12 7.5 12-7.5H0z"/>
      <path fill="#EA4335" d="M0 1.5v15h4.5V7.5L12 13l7.5-5.5V16.5H24v-15L12 9z"/>
    </svg>
  );
}

// ─── Invite contact modal ────────────────────────────────────────────────────

const COUNTRY_CODES = [
  { code: "+55", flag: "🇧🇷", name: "Brasil" },
  { code: "+1",  flag: "🇺🇸", name: "EUA / Canadá" },
  { code: "+351", flag: "🇵🇹", name: "Portugal" },
  { code: "+54", flag: "🇦🇷", name: "Argentina" },
  { code: "+52", flag: "🇲🇽", name: "México" },
  { code: "+57", flag: "🇨🇴", name: "Colômbia" },
  { code: "+56", flag: "🇨🇱", name: "Chile" },
  { code: "+598", flag: "🇺🇾", name: "Uruguai" },
  { code: "+595", flag: "🇵🇾", name: "Paraguai" },
  { code: "+244", flag: "🇦🇴", name: "Angola" },
  { code: "+258", flag: "🇲🇿", name: "Moçambique" },
  { code: "+238", flag: "🇨🇻", name: "Cabo Verde" },
  { code: "+44",  flag: "🇬🇧", name: "Reino Unido" },
  { code: "+49",  flag: "🇩🇪", name: "Alemanha" },
  { code: "+33",  flag: "🇫🇷", name: "França" },
  { code: "+34",  flag: "🇪🇸", name: "Espanha" },
  { code: "+39",  flag: "🇮🇹", name: "Itália" },
  { code: "+61",  flag: "🇦🇺", name: "Austrália" },
  { code: "+81",  flag: "🇯🇵", name: "Japão" },
  { code: "+91",  flag: "🇮🇳", name: "Índia" },
  { code: "+971", flag: "🇦🇪", name: "Emirados" },
] as const;

function formatBrazilianPhone(digits: string): string {
  const d = digits.slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function InviteContactModal({
  type,
  workspaceName,
  inviteLink,
  senderName,
  members,
  onClose
}: {
  type: "whatsapp" | "email";
  workspaceName: string;
  inviteLink: string;
  senderName: string;
  members: Member[];
  onClose: () => void;
}) {
  const [countryCode, setCountryCode] = useState("+55");
  const [rawPhone, setRawPhone] = useState("");
  const [emailAddr, setEmailAddr] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const isWa = type === "whatsapp";

  const displayPhone = countryCode === "+55" ? formatBrazilianPhone(rawPhone.replace(/\D/g, "")) : rawPhone;

  function handlePhoneChange(val: string) {
    if (countryCode === "+55") {
      setRawPhone(val.replace(/\D/g, "").slice(0, 11));
    } else {
      setRawPhone(val);
    }
  }

  async function send() {
    setErr("");
    if (isWa) {
      const digits = rawPhone.replace(/\D/g, "");
      if (!digits) { setErr("Digite o número do WhatsApp."); return; }
      const phone = countryCode.replace("+", "") + digits;
      setSending(true);
      try {
        const resp = await fetch(SEND_WA_FUNCTION_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, workspaceName, inviteLink, fromName: senderName })
        });
        const data = await resp.json() as { success?: boolean; error?: string };
        if (!resp.ok || data.error) throw new Error(data.error || "Falha ao enviar.");
        setSent(true);
      } catch (e) {
        setErr(getUserFacingError(e, "data"));
      } finally {
        setSending(false);
      }
    } else {
      if (!emailAddr.trim()) { setErr("Digite o email do convidado."); return; }
      if (members.some(m => m.email === emailAddr.trim() && m.status === "active")) {
        setErr("Este e-mail já tem acesso à conta.");
        return;
      }
      setSending(true);
      try {
        const resp = await fetch(SEND_EMAIL_FUNCTION_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: emailAddr.trim(), workspaceName, inviteLink, fromName: senderName })
        });
        const data = await resp.json() as { success?: boolean; error?: string };
        if (!resp.ok || data.error) throw new Error(data.error || "Falha ao enviar.");
        setSent(true);
      } catch (e) {
        setErr(getUserFacingError(e, "data"));
      } finally {
        setSending(false);
      }
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8, color: "#fff", fontSize: 14, padding: "10px 12px",
    outline: "none", marginBottom: 12, colorScheme: "dark"
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div style={{ background: "#111214", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "28px 28px 24px", width: "100%", maxWidth: 400, animation: "fadeUp .2s ease both" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          {isWa ? <WhatsAppIcon /> : <GmailIcon />}
          <h3 style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>
            {isWa ? "Enviar por WhatsApp" : "Enviar por Email"}
          </h3>
        </div>

        {sent ? (
          <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: G, marginBottom: 6 }}>{isWa ? "Mensagem enviada!" : "Email enviado!"}</p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>O convite foi enviado para {isWa ? displayPhone : emailAddr}.</p>
            <button onClick={onClose} style={{ marginTop: 20, width: "100%", padding: "10px", borderRadius: 8, background: G, border: "none", color: "#000", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Fechar</button>
          </div>
        ) : (
          <>
            {isWa ? (
              <>
                <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.4)", marginBottom: 14, lineHeight: 1.6 }}>
                  Selecione o país e informe o número. Você pode deixar em branco para escolher o contato no WhatsApp.
                </p>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <select
                    value={countryCode}
                    onChange={(e) => { setCountryCode(e.target.value); setRawPhone(""); }}
                    style={{ flex: "0 0 auto", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", fontSize: 13, padding: "10px 8px", outline: "none", cursor: "pointer" }}
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code + c.name} value={c.code} style={{ background: "#1a1a1d" }}>
                        {c.flag} {c.code} {c.name}
                      </option>
                    ))}
                  </select>
                  <input
                    autoFocus
                    type="tel"
                    placeholder={countryCode === "+55" ? "(11) 99999-9999" : "Número com DDD"}
                    value={displayPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                  />
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.4)", marginBottom: 14, lineHeight: 1.6 }}>
                  O convidado receberá um email com o link de acesso ao workspace.
                </p>
                <input
                  autoFocus
                  type="email"
                  placeholder="email@exemplo.com"
                  value={emailAddr}
                  onChange={(e) => setEmailAddr(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  style={inputStyle}
                />
              </>
            )}

            {err && <p style={{ fontSize: 12, color: "#ff8080", marginBottom: 10, marginTop: -4 }}>{err}</p>}

            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={send} disabled={sending} style={{ flex: 2, padding: "10px", borderRadius: 8, background: isWa ? "#25D366" : G, border: "none", color: "#000", fontSize: 13, fontWeight: 800, cursor: "pointer", opacity: sending ? 0.6 : 1 }}>
                {sending ? "Enviando..." : isWa ? "Enviar no WhatsApp" : "Enviar"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CenteredStatus({ text: _ }: { text: string }) {
  return <SalvoLoader />;
}

function SalvoLoader() {
  const RINGS = [160, 118, 82, 48] as const;
  return (
    <div style={{ minHeight: "100vh", background: "#050505", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative", width: 180, height: 180 }}>
        {RINGS.map((size, i) => (
          <div
            key={i}
            style={{
              position: "absolute", top: "50%", left: "50%",
              width: size, height: size, borderRadius: "50%",
              transform: "translate(-50%, -50%)",
              border: `${i === 3 ? 2 : 1}px solid rgba(184,245,90,${(0.85 - i * 0.19).toFixed(2)})`,
              boxShadow: `0 0 ${28 - i * 6}px rgba(184,245,90,${(0.22 - i * 0.045).toFixed(3)}), inset 0 0 ${16 - i * 3}px rgba(184,245,90,${(0.06 - i * 0.012).toFixed(3)})`,
              animation: "neonPulse 3s ease-in-out infinite",
              animationDelay: `${i * 0.28}s`
            }}
          />
        ))}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          width: 14, height: 14, borderRadius: "50%",
          background: G,
          animation: "neonCenterPulse 3s ease-in-out infinite"
        }} />
      </div>
    </div>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-panel" style={{ minHeight: "100vh" }}>
      <div className="card auth-card section">{children}</div>
    </main>
  );
}

async function ensureDefaultWorkspace(user: User, displayName: string): Promise<string> {
  const workspaceRef = doc(collection(db, "workspaces"));
  const batch = writeBatch(db);

  batch.set(workspaceRef, {
    name: "Minha vida financeira",
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  batch.set(doc(db, "workspaces", workspaceRef.id, "members", user.uid), {
    uid: user.uid,
    role: "owner",
    status: "active",
    displayName,
    email: user.email || "",
    createdBy: user.uid,
    joinedAt: serverTimestamp()
  });

  await batch.commit();

  await updateDoc(doc(db, "users", user.uid), {
    workspaceIds: [workspaceRef.id],
    updatedAt: serverTimestamp()
  });

  return workspaceRef.id;
}

// Removed local errorMessage — all error mapping goes through getUserFacingError in src/lib/errors.ts

function isPermissionDenied(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e.code === "permission-denied" || (e.message ?? "").includes("Missing or insufficient permissions");
}
