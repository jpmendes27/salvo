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
  collection,
  collectionGroup,
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
  Copy,
  Handshake,
  LogOut,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Users
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { auth, db, googleProvider } from "@/lib/firebase";
import { consentText, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { currentMonthKey, formatCurrency, monthLabel } from "@/lib/money";
import { buildMonthlySummary } from "@/lib/summary";
import type { Member, Transaction, TransactionType, Workspace } from "@/lib/types";
import { defaultCategories, demoTransactions } from "@/lib/demo";

type Profile = {
  uid: string;
  displayName: string;
  email: string;
  hasCreatedRealMonth?: boolean;
  acceptedTermsVersion?: string;
  acceptedPrivacyVersion?: string;
};

type WorkspaceWithMember = {
  workspace: Workspace;
  member: Member;
};

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <CenteredStatus text="Preparando seu Fincheck Pro..." />;
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (!user.emailVerified) {
    return <VerifyEmail user={user} />;
  }

  return <AuthenticatedApp user={user} />;
}

function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleGoogle() {
    setError("");
    setBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleEmail(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);

    try {
      if (mode === "signup") {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(credential.user);
        window.localStorage.setItem("fincheck:pendingName", name);
        setMessage("Conta criada. Confirme seu e-mail para liberar seu workspace.");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!email) {
      setError("Digite seu e-mail para receber a recuperacao de senha.");
      return;
    }
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Enviamos o link de recuperacao para seu e-mail.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="brand" style={{ marginBottom: 36 }}>
          <span className="brand-mark">F</span>
          <span>Fincheck Pro</span>
        </div>
        <h1>O futuro das financas tambem pode ser compartilhado.</h1>
        <p>
          Comece solo ou convide alguem para cuidar da mesma vida financeira com
          clareza, direitos simples e um resumo mensal que fala a lingua da vida real.
        </p>
      </section>

      <section className="auth-panel">
        <div className="card auth-card section">
          <div>
            <h2>{mode === "signin" ? "Entrar" : "Criar conta"}</h2>
            <p className="muted">
              Use Google ou e-mail e senha. Telefone e renda ficam para quando fizerem sentido.
            </p>
          </div>

          {error && <div className="error">{error}</div>}
          {message && <div className="success">{message}</div>}

          <button className="btn" onClick={handleGoogle} disabled={busy}>
            Entrar com Google <ArrowRight size={17} />
          </button>

          <form className="form-grid" onSubmit={handleEmail}>
            {mode === "signup" && (
              <input
                className="input"
                placeholder="Seu nome"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            )}
            <input
              className="input"
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <input
              className="input"
              type="password"
              placeholder="Senha"
              value={password}
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button className="btn secondary" disabled={busy}>
              {mode === "signin" ? "Entrar com e-mail" : "Criar conta por e-mail"}
            </button>
          </form>

          <div className="button-row">
            <button
              className="btn ghost"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Criar uma conta" : "Ja tenho conta"}
            </button>
            <button className="btn ghost" onClick={handleReset}>
              Esqueci minha senha
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function VerifyEmail({ user }: { user: User }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    setError("");
    try {
      await reload(user);
      if (auth.currentUser?.emailVerified) {
        window.location.reload();
      } else {
        setMessage("Ainda nao confirmamos seu e-mail. Confira sua caixa de entrada.");
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function resend() {
    setError("");
    try {
      await sendEmailVerification(user);
      setMessage("Reenviamos a verificacao.");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <CenteredCard>
      <h1>Confirme seu e-mail</h1>
      <p className="muted">
        Enviamos uma verificacao para {user.email}. Depois disso voce acessa seu workspace.
      </p>
      {message && <div className="success">{message}</div>}
      {error && <div className="error">{error}</div>}
      <div className="button-row">
        <button className="btn" onClick={refresh}>
          <RefreshCw size={17} /> Ja confirmei
        </button>
        <button className="btn secondary" onClick={resend}>
          Reenviar e-mail
        </button>
        <button className="btn ghost" onClick={() => signOut(auth)}>
          Sair
        </button>
      </div>
    </CenteredCard>
  );
}

function AuthenticatedApp({ user }: { user: User }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceWithMember[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      const snap = await getDoc(doc(db, "users", user.uid));
      setProfile(snap.exists() ? (snap.data() as Profile) : null);
      setLoading(false);
    }
    loadProfile().catch((err) => {
      setError(errorMessage(err));
      setLoading(false);
    });
  }, [user.uid]);

  useEffect(() => {
    if (!profile?.acceptedTermsVersion) return;

    const membersQuery = query(
      collectionGroup(db, "members"),
      where("uid", "==", user.uid),
      where("status", "==", "active")
    );

    return onSnapshot(
      membersQuery,
      async (snapshot) => {
        const entries = await Promise.all(
          snapshot.docs.map(async (memberDoc) => {
            const workspaceRef = memberDoc.ref.parent.parent;
            if (!workspaceRef) return null;
            const workspaceSnap = await getDoc(workspaceRef);
            if (!workspaceSnap.exists()) return null;
            return {
              workspace: { id: workspaceSnap.id, ...workspaceSnap.data() } as Workspace,
              member: {
                id: memberDoc.id,
                workspaceId: workspaceSnap.id,
                ...memberDoc.data()
              } as Member
            };
          })
        );

        const filtered = entries.filter(Boolean) as WorkspaceWithMember[];
        setWorkspaces(filtered);
        setActiveWorkspaceId((current) => current || filtered[0]?.workspace.id || "");
      },
      (err) => setError(errorMessage(err))
    );
  }, [profile?.acceptedTermsVersion, user.uid]);

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

      setProfile(nextProfile);
      window.localStorage.removeItem("fincheck:pendingName");
      await ensureDefaultWorkspace(user, displayName);
    } catch (err) {
      setError(errorMessage(err));
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
    return <LegalGate onAccept={acceptLegal} />;
  }

  if (!workspaces.length) {
    return <CenteredStatus text="Criando seu primeiro workspace..." />;
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
        O Fincheck Pro guarda apenas os dados necessarios para sua gestao financeira. Se voce
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

function WorkspaceApp({
  user,
  profile,
  setProfile,
  workspaces,
  activeEntry,
  onSelectWorkspace
}: {
  user: User;
  profile: Profile;
  setProfile: (profile: Profile) => void;
  workspaces: WorkspaceWithMember[];
  activeEntry: WorkspaceWithMember;
  onSelectWorkspace: (workspaceId: string) => void;
}) {
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [waitlistDone, setWaitlistDone] = useState(false);

  const workspace = activeEntry.workspace;
  const member = activeEntry.member;
  const isOwner = member.role === "owner";
  const showDemo = !profile.hasCreatedRealMonth && transactions.length === 0;
  const visibleTransactions = showDemo ? demoTransactions : transactions;
  const summary = useMemo(
    () => buildMonthlySummary(visibleTransactions, showDemo ? "2026-04" : monthKey),
    [monthKey, showDemo, visibleTransactions]
  );

  useEffect(() => {
    setLoading(true);
    const txQuery = query(
      collection(db, "workspaces", workspace.id, "transactions"),
      where("monthKey", "==", monthKey),
      orderBy("date", "desc")
    );

    return onSnapshot(
      txQuery,
      (snapshot) => {
        setTransactions(
          snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Transaction)
        );
        setLoading(false);
      },
      (err) => {
        setError(errorMessage(err));
        setLoading(false);
      }
    );
  }, [workspace.id, monthKey]);

  async function createInvite() {
    setError("");
    try {
      const token = crypto.randomUUID();
      await setDoc(doc(db, "invites", token), {
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        createdBy: user.uid,
        status: "active",
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
      });
      setInviteLink(`${window.location.origin}/convite?token=${token}`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function joinWaitlist() {
    await setDoc(
      doc(db, "workspaces", workspace.id, "openFinanceWaitlist", user.uid),
      {
        uid: user.uid,
        email: user.email || "",
        displayName: profile.displayName,
        workspaceId: workspace.id,
        createdAt: serverTimestamp(),
        source: "dashboard_cta"
      },
      { merge: true }
    );
    setWaitlistDone(true);
  }

  async function deleteWorkspace() {
    const confirmation = window.prompt(
      `Digite ${workspace.name} para excluir este workspace e seus dados financeiros.`
    );
    if (confirmation !== workspace.name) return;

    const batch = writeBatch(db);
    const childCollections = ["transactions", "categories", "summaries", "openFinanceWaitlist"];

    for (const collectionName of childCollections) {
      const snapshot = await getDocs(collection(db, "workspaces", workspace.id, collectionName));
      snapshot.docs.forEach((item) => batch.delete(item.ref));
    }

    await updateDoc(doc(db, "workspaces", workspace.id), {
      confirmDelete: true,
      updatedAt: serverTimestamp()
    });
    batch.delete(doc(db, "workspaces", workspace.id));
    await batch.commit();

    const membersSnap = await getDocs(collection(db, "workspaces", workspace.id, "members"));
    const memberDeletes = membersSnap.docs.sort((a, b) => {
      if (a.id === user.uid) return 1;
      if (b.id === user.uid) return -1;
      return 0;
    });
    for (const memberDoc of memberDeletes) {
      await deleteDoc(memberDoc.ref);
    }
  }

  async function leaveWorkspace() {
    await updateDoc(doc(db, "workspaces", workspace.id, "members", user.uid), {
      status: "left",
      leftAt: serverTimestamp()
    });
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">F</span>
          <span>Fincheck Pro</span>
        </div>
        <div className="button-row">
          <select
            className="select"
            value={workspace.id}
            onChange={(event) => onSelectWorkspace(event.target.value)}
            aria-label="Workspace"
          >
            {workspaces.map((entry) => (
              <option key={entry.workspace.id} value={entry.workspace.id}>
                {entry.workspace.name}
              </option>
            ))}
          </select>
          <button className="btn secondary" onClick={() => signOut(auth)}>
            <LogOut size={17} /> Sair
          </button>
        </div>
      </header>

      <div className="page section">
        <div className="section-header">
          <div>
            <h1>{workspace.name}</h1>
            <p className="muted">
              {member.role === "owner" ? "Owner" : "Editor"} da vida financeira compartilhada.
            </p>
          </div>
          <input
            className="input"
            style={{ maxWidth: 180 }}
            type="month"
            value={monthKey}
            onChange={(event) => setMonthKey(event.target.value)}
          />
        </div>

        {showDemo && (
          <div className="demo-banner">
            <div>
              <strong>Veja como o resumo fica antes de lancar seus dados.</strong>
              <div className="muted">
                Assim que voce criar o primeiro lancamento real, a demo sai do caminho.
              </div>
            </div>
            <span className="tag">Demo</span>
          </div>
        )}

        {error && <div className="error">{error}</div>}

        <section className="stats-grid">
          <Stat label="Entradas" value={formatCurrency(summary.income)} tone="income" />
          <Stat label="Saidas" value={formatCurrency(summary.expense)} tone="expense" />
          <Stat label="Saldo" value={formatCurrency(summary.balance)} tone="balance" />
        </section>

        <section className="dashboard-grid">
          <div className="section">
            <TransactionForm
              user={user}
              profile={profile}
              workspaceId={workspace.id}
              monthKey={monthKey}
              onCreated={async () => {
                if (!profile.hasCreatedRealMonth) {
                  const nextProfile = { ...profile, hasCreatedRealMonth: true };
                  await updateDoc(doc(db, "users", user.uid), {
                    hasCreatedRealMonth: true,
                    updatedAt: serverTimestamp()
                  });
                  setProfile(nextProfile);
                }
              }}
            />

            <div className="panel">
              <div className="section-header">
                <h2>Lancamentos</h2>
                {loading && <span className="muted">Carregando...</span>}
              </div>
              <div className="transaction-list">
                {visibleTransactions.map((transaction) => (
                  <TransactionRow
                    key={transaction.id}
                    workspaceId={workspace.id}
                    transaction={transaction}
                    readonly={showDemo}
                  />
                ))}
              </div>
            </div>
          </div>

          <aside className="section">
            <div className="panel section">
              <h2>Resumo de {monthLabel(showDemo ? "2026-04" : monthKey)}</h2>
              {summary.insights.map((insight) => (
                <p key={insight} className="muted">
                  {insight}
                </p>
              ))}
              <textarea className="textarea" readOnly value={summary.shareText} />
              <button
                className="btn secondary"
                onClick={() => navigator.clipboard.writeText(summary.shareText)}
              >
                <Copy size={17} /> Copiar resumo
              </button>
            </div>

            <div className="panel section">
              <h2>Compartilhar acesso</h2>
              <p className="muted">
                Convide alguem para ver e editar os dados deste workspace como editor.
              </p>
              {isOwner ? (
                <>
                  <button className="btn" onClick={createInvite}>
                    <Users size={17} /> Criar link de convite
                  </button>
                  {inviteLink && (
                    <div className="success">
                      <div style={{ wordBreak: "break-all" }}>{inviteLink}</div>
                      <button
                        className="btn secondary"
                        style={{ marginTop: 10 }}
                        onClick={() => navigator.clipboard.writeText(inviteLink)}
                      >
                        <Copy size={17} /> Copiar link
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="muted">Apenas owners gerenciam convites na v1.</div>
              )}
            </div>

            <div className="panel section">
              <h2>Open Finance</h2>
              <p className="muted">
                Estamos avaliando conexao bancaria automatica. Entre na fila sem compartilhar
                dados bancarios agora.
              </p>
              {waitlistDone ? (
                <div className="success">Interesse registrado.</div>
              ) : (
                <button className="btn secondary" onClick={joinWaitlist}>
                  <Handshake size={17} /> Quero entrar na fila
                </button>
              )}
            </div>

            <div className="panel section">
              <h2>Controle do workspace</h2>
              {isOwner ? (
                <button className="btn danger" onClick={deleteWorkspace}>
                  <Trash2 size={17} /> Excluir workspace
                </button>
              ) : (
                <button className="btn secondary" onClick={leaveWorkspace}>
                  Sair deste workspace
                </button>
              )}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function TransactionForm({
  user,
  profile,
  workspaceId,
  monthKey,
  onCreated
}: {
  user: User;
  profile: Profile;
  workspaceId: string;
  monthKey: string;
  onCreated: () => Promise<void>;
}) {
  const [type, setType] = useState<TransactionType>("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Alimentacao");
  const [date, setDate] = useState(`${monthKey}-01`);
  const [busy, setBusy] = useState(false);
  const categories = defaultCategories.filter((item) => item.type === type);

  useEffect(() => {
    setDate(`${monthKey}-01`);
  }, [monthKey]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await addDoc(collection(db, "workspaces", workspaceId, "transactions"), {
        type,
        description,
        amount: Number(amount),
        category,
        date,
        monthKey,
        createdBy: user.uid,
        createdByName: profile.displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setDescription("");
      setAmount("");
      await onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel section" onSubmit={submit}>
      <div className="section-header">
        <h2>Novo lancamento</h2>
        <span className="tag">{type === "income" ? "Entrada" : "Saida"}</span>
      </div>
      <div className="two-col">
        <select
          className="select"
          value={type}
          onChange={(event) => {
            const nextType = event.target.value as TransactionType;
            setType(nextType);
            setCategory(nextType === "income" ? "Renda" : "Alimentacao");
          }}
        >
          <option value="expense">Saida</option>
          <option value="income">Entrada</option>
        </select>
        <input
          className="input"
          type="number"
          min="0"
          step="0.01"
          placeholder="Valor"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          required
        />
      </div>
      <input
        className="input"
        placeholder="Descricao"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        required
      />
      <div className="two-col">
        <select
          className="select"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          {categories.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>
        <input
          className="input"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          required
        />
      </div>
      <button className="btn" disabled={busy}>
        <Plus size={17} /> Lancar
      </button>
    </form>
  );
}

function TransactionRow({
  workspaceId,
  transaction,
  readonly
}: {
  workspaceId: string;
  transaction: Transaction;
  readonly: boolean;
}) {
  async function remove() {
    await deleteDoc(doc(db, "workspaces", workspaceId, "transactions", transaction.id));
  }

  return (
    <div className="transaction">
      <div>
        <strong>{transaction.description}</strong>
        <div className="muted">
          {transaction.category} · {transaction.date} · {transaction.createdByName}
        </div>
      </div>
      <span className={transaction.type === "income" ? "amount-income" : "amount-expense"}>
        {transaction.type === "income" ? "+" : "-"}
        {formatCurrency(transaction.amount)}
      </span>
      {!readonly && (
        <button className="btn ghost" aria-label="Excluir lancamento" onClick={remove}>
          <Trash2 size={17} />
        </button>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="stat">
      <span className="muted">{label}</span>
      <strong className={tone === "income" ? "amount-income" : tone === "expense" ? "amount-expense" : ""}>
        {value}
      </strong>
    </div>
  );
}

function CenteredStatus({ text }: { text: string }) {
  return (
    <main className="auth-panel" style={{ minHeight: "100vh" }}>
      <p className="muted">{text}</p>
    </main>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-panel" style={{ minHeight: "100vh" }}>
      <div className="card auth-card section">{children}</div>
    </main>
  );
}

async function ensureDefaultWorkspace(user: User, displayName: string) {
  const memberQuery = query(
    collectionGroup(db, "members"),
    where("uid", "==", user.uid),
    where("status", "==", "active")
  );
  const existing = await getDocs(memberQuery);
  if (!existing.empty) return;

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
}

function errorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  return "Algo saiu do eixo. Tente de novo.";
}
