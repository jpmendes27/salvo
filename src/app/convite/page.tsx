"use client";

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  type User
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import { ArrowRight, MailCheck } from "lucide-react";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { auth, db, googleProvider } from "@/lib/firebase";
import { consentText, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import type { Invite } from "@/lib/types";

export default function InvitePage() {
  return (
    <Suspense fallback={<InviteShell text="Abrindo convite..." />}>
      <InviteFlow />
    </Suspense>
  );
}

function InviteFlow() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [user, setUser] = useState<User | null>(null);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [needsLegal, setNeedsLegal] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    async function loadInvite() {
      if (!user?.emailVerified || !token) return;
      setLoading(true);
      try {
        const inviteSnap = await getDoc(doc(db, "invites", token));
        if (!inviteSnap.exists()) {
          setError("Convite nao encontrado ou expirado.");
          return;
        }
        setInvite({ id: inviteSnap.id, ...inviteSnap.data() } as Invite);

        const profileSnap = await getDoc(doc(db, "users", user.uid));
        setNeedsLegal(!profileSnap.exists() || !profileSnap.data().acceptedTermsVersion);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    loadInvite();
  }, [token, user]);

  async function acceptInvite() {
    if (!user || !invite) return;
    setError("");
    try {
      const displayName = user.displayName || user.email?.split("@")[0] || "Pessoa convidada";

      if (needsLegal) {
        if (!accepted) {
          setError("Aceite os Termos e a Politica de Privacidade para entrar.");
          return;
        }
        await setDoc(
          doc(db, "users", user.uid),
          {
            uid: user.uid,
            displayName,
            email: user.email || "",
            hasCreatedRealMonth: false,
            acceptedTermsVersion: TERMS_VERSION,
            acceptedPrivacyVersion: PRIVACY_VERSION,
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
        await addDoc(collection(db, "consents"), {
          uid: user.uid,
          email: user.email || "",
          termsVersion: TERMS_VERSION,
          privacyVersion: PRIVACY_VERSION,
          text: consentText,
          purpose: "invite_workspace_access",
          createdAt: serverTimestamp()
        });
      }

      await setDoc(doc(db, "workspaces", invite.workspaceId, "members", user.uid), {
        uid: user.uid,
        role: "editor",
        status: "active",
        displayName,
        email: user.email || "",
        inviteId: invite.id,
        joinedAt: serverTimestamp()
      });

      setMessage("Voce entrou no workspace. Abrindo o Fincheck Pro...");
      window.setTimeout(() => {
        window.location.href = "/";
      }, 900);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (!token) {
    return <InviteShell text="Link de convite invalido." />;
  }

  if (loading) {
    return <InviteShell text="Validando convite..." />;
  }

  if (!user) {
    return <InviteAuth />;
  }

  if (!user.emailVerified) {
    return <InviteVerifyEmail user={user} />;
  }

  return (
    <main className="auth-panel" style={{ minHeight: "100vh" }}>
      <section className="card auth-card section">
        <div className="brand">
          <span className="brand-mark">F</span>
          <span>Fincheck Pro</span>
        </div>
        <h1>Convite para compartilhar uma vida financeira</h1>
        {invite && (
          <p className="muted">
            Voce tera acesso como editor ao workspace {invite.workspaceName}: podera ver,
            criar e editar lancamentos financeiros.
          </p>
        )}
        {needsLegal && (
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
            />
            <span>
              Li e aceito os <a href="/termos">Termos</a> e a{" "}
              <a href="/privacidade">Politica de Privacidade</a>.
            </span>
          </label>
        )}
        {error && <div className="error">{error}</div>}
        {message && <div className="success">{message}</div>}
        <button className="btn" onClick={acceptInvite}>
          Aceitar convite <ArrowRight size={17} />
        </button>
      </section>
    </main>
  );
}

function InviteAuth() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      if (mode === "signup") {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(credential.user);
        setMessage("Conta criada. Confirme seu e-mail para aceitar o convite.");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <main className="auth-panel" style={{ minHeight: "100vh" }}>
      <section className="card auth-card section">
        <h1>Entre para aceitar o convite</h1>
        <button className="btn" onClick={() => signInWithPopup(auth, googleProvider)}>
          Entrar com Google
        </button>
        <form className="form-grid" onSubmit={submit}>
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
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button className="btn secondary">
            {mode === "signin" ? "Entrar com e-mail" : "Criar conta"}
          </button>
        </form>
        <button
          className="btn ghost"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "Criar conta por e-mail" : "Ja tenho conta"}
        </button>
        {error && <div className="error">{error}</div>}
        {message && <div className="success">{message}</div>}
      </section>
    </main>
  );
}

function InviteVerifyEmail({ user }: { user: User }) {
  async function refresh() {
    await reload(user);
    if (auth.currentUser?.emailVerified) {
      window.location.reload();
    }
  }

  return (
    <main className="auth-panel" style={{ minHeight: "100vh" }}>
      <section className="card auth-card section">
        <MailCheck size={34} />
        <h1>Confirme seu e-mail</h1>
        <p className="muted">Depois da confirmacao, volte aqui para aceitar o convite.</p>
        <button className="btn" onClick={refresh}>
          Ja confirmei
        </button>
      </section>
    </main>
  );
}

function InviteShell({ text }: { text: string }) {
  return (
    <main className="auth-panel" style={{ minHeight: "100vh" }}>
      <p className="muted">{text}</p>
    </main>
  );
}

function errorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  return "Nao foi possivel concluir agora.";
}
