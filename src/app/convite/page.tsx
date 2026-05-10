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
import { Eye, Calendar, TrendingUp, Check } from "lucide-react";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { auth, db, googleProvider } from "@/lib/firebase";
import { consentText, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import type { Invite } from "@/lib/types";

const G = "#b8f55a";
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 0 }}>
      <span style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 700, fontSize: "1.1rem", color: G, letterSpacing: "-0.02em", lineHeight: 1 }}>
        fincheck
      </span>
      <span style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 700, fontSize: "1.1rem", color: "#fff", letterSpacing: "-0.02em", lineHeight: 1 }}>
        pro
      </span>
      <sup style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.42rem", verticalAlign: "super", color: G, fontWeight: 400, marginLeft: 1 }}>
        ®
      </sup>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<InviteShell />}>
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
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
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
          setError("Convite não encontrado ou expirado.");
          return;
        }
        const data = { id: inviteSnap.id, ...inviteSnap.data() } as Invite;
        if (data.status !== "active") {
          setError("Este convite já foi usado ou foi cancelado.");
          return;
        }
        setInvite(data);
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
    setBusy(true);
    try {
      const displayName = user.displayName || user.email?.split("@")[0] || "Pessoa convidada";

      if (needsLegal) {
        if (!accepted) {
          setError("Aceite os Termos e a Política de Privacidade para entrar.");
          setBusy(false);
          return;
        }
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          displayName,
          email: user.email || "",
          hasCreatedRealMonth: false,
          acceptedTermsVersion: TERMS_VERSION,
          acceptedPrivacyVersion: PRIVACY_VERSION,
          updatedAt: serverTimestamp()
        }, { merge: true });
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

      setDone(true);
      setTimeout(() => {
        window.location.href = `${BASE}/?workspace=${invite.workspaceId}`;
      }, 1400);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (!token) return <InviteShell error="Link de convite inválido." />;
  if (loading) return <InviteShell />;
  if (!user) return <InviteAuth />;
  if (!user.emailVerified) return <InviteVerifyEmail user={user} />;

  const inviterName = invite?.createdByName || "Alguém";
  const firstLetter = inviterName.charAt(0).toUpperCase();

  return (
    <main style={{
      minHeight: "100vh",
      background: "#09090b",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
      fontFamily: "'Plus Jakarta Sans', sans-serif"
    }}>
      <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 0 }}>
        {/* Logo */}
        <div style={{ marginBottom: 36 }}>
          <Logo />
        </div>

        {done ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: G, display: "flex", alignItems: "center",
              justifyContent: "center", margin: "0 auto 20px"
            }}>
              <Check size={28} color="#09090b" strokeWidth={3} />
            </div>
            <p style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 700, margin: "0 0 8px" }}>
              Você entrou!
            </p>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.9rem", margin: 0 }}>
              Abrindo o painel…
            </p>
          </div>
        ) : (
          <>
            {/* Avatar + headline */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ position: "relative", display: "inline-block", marginBottom: 20 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: "rgba(184,245,90,0.12)",
                  border: "1.5px solid rgba(184,245,90,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.4rem", fontWeight: 700, color: G
                }}>
                  {firstLetter}
                </div>
                <div style={{
                  position: "absolute", bottom: -2, right: -2,
                  width: 20, height: 20, borderRadius: "50%",
                  background: G, border: "2px solid #09090b",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <span style={{ color: "#09090b", fontSize: "0.7rem", fontWeight: 900, lineHeight: 1 }}>+</span>
                </div>
              </div>

              <h1 style={{
                margin: "0 0 10px",
                fontSize: "1.45rem",
                fontWeight: 800,
                color: "#fff",
                lineHeight: 1.25,
                letterSpacing: "-0.025em"
              }}>
                {inviterName} quer gerir as finanças com você
              </h1>
              <p style={{ margin: 0, color: "rgba(255,255,255,0.5)", fontSize: "0.9rem", lineHeight: 1.6 }}>
                Acompanhem juntos o que entra, o que sai e o que ainda está por vir — sem surpresa no fim do mês.
              </p>
            </div>

            {/* Perks */}
            {!error && invite && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
                {[
                  { icon: Eye, text: "Visão unificada de todas as finanças" },
                  { icon: Calendar, text: "Planejamento mês a mês em tempo real" },
                  { icon: TrendingUp, text: "Acompanhe tendências de gastos e economia" }
                ].map(({ icon: Icon, text }) => (
                  <div key={text} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                      background: "rgba(184,245,90,0.08)",
                      border: "1px solid rgba(184,245,90,0.15)",
                      display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                      <Icon size={15} color={G} />
                    </div>
                    <span style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.875rem" }}>{text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Legal */}
            {needsLegal && invite && (
              <label style={{
                display: "flex", gap: 10, alignItems: "flex-start",
                marginBottom: 20, cursor: "pointer"
              }}>
                <div
                  onClick={() => setAccepted(v => !v)}
                  style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1,
                    border: `1.5px solid ${accepted ? G : "rgba(255,255,255,0.2)"}`,
                    background: accepted ? G : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", transition: "all .15s"
                  }}
                >
                  {accepted && <Check size={11} color="#09090b" strokeWidth={3} />}
                </div>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem", lineHeight: 1.6 }}>
                  Li e aceito os{" "}
                  <a href={`${BASE}/termos`} style={{ color: G, textDecoration: "none" }}>Termos</a>
                  {" "}e a{" "}
                  <a href={`${BASE}/privacidade`} style={{ color: G, textDecoration: "none" }}>Política de Privacidade</a>.
                </span>
              </label>
            )}

            {/* Error */}
            {error && (
              <div style={{
                padding: "12px 14px", borderRadius: 10, marginBottom: 16,
                background: "rgba(255,128,128,0.08)",
                border: "1px solid rgba(255,128,128,0.2)",
                color: "#ff8080", fontSize: "0.85rem", lineHeight: 1.5
              }}>
                {error}
              </div>
            )}

            {/* CTAs */}
            {invite && !error && (
              <>
                <button
                  onClick={acceptInvite}
                  disabled={busy}
                  style={{
                    width: "100%", padding: "14px", borderRadius: 12,
                    background: busy ? "rgba(184,245,90,0.5)" : G,
                    color: "#09090b", border: "none", cursor: busy ? "default" : "pointer",
                    fontSize: "0.95rem", fontWeight: 800, letterSpacing: "-0.01em",
                    transition: "opacity .15s"
                  }}
                >
                  {busy ? "Entrando…" : "Aceitar convite"}
                </button>
                <button
                  onClick={() => { window.location.href = `${BASE}/`; }}
                  style={{
                    width: "100%", padding: "12px", borderRadius: 12,
                    background: "transparent", color: "rgba(255,255,255,0.3)",
                    border: "none", cursor: "pointer",
                    fontSize: "0.85rem", fontWeight: 500, marginTop: 6
                  }}
                >
                  Recusar convite
                </button>
              </>
            )}

            {error && !invite && (
              <button
                onClick={() => { window.location.href = `${BASE}/`; }}
                style={{
                  width: "100%", padding: "14px", borderRadius: 12,
                  background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)",
                  border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer",
                  fontSize: "0.9rem", fontWeight: 600
                }}
              >
                Ir para o Fincheck Pro
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function InviteAuth() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signup") {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(credential.user);
        setMessage("Conta criada! Confirme seu e-mail para aceitar o convite.");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{
      minHeight: "100vh", background: "#09090b",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "24px 16px", fontFamily: "'Plus Jakarta Sans', sans-serif"
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ marginBottom: 32 }}><Logo /></div>

        <h1 style={{
          margin: "0 0 6px", fontSize: "1.4rem", fontWeight: 800,
          color: "#fff", letterSpacing: "-0.025em"
        }}>
          {mode === "signin" ? "Entre para aceitar" : "Crie sua conta"}
        </h1>
        <p style={{ margin: "0 0 24px", color: "rgba(255,255,255,0.45)", fontSize: "0.9rem" }}>
          {mode === "signin" ? "Faça login para ver o convite." : "Leva menos de 1 minuto."}
        </p>

        <button
          onClick={() => { setError(""); signInWithPopup(auth, googleProvider).catch(e => setError(errorMessage(e))); }}
          style={{
            width: "100%", padding: "13px", borderRadius: 12,
            background: "#fff", color: "#111", border: "none",
            cursor: "pointer", fontSize: "0.9rem", fontWeight: 700,
            marginBottom: 14, display: "flex", alignItems: "center",
            justifyContent: "center", gap: 10
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908C16.658 14.186 17.64 11.926 17.64 9.2z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.859-3.048.859-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Entrar com Google
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
          <span style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.75rem" }}>ou</span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="email" placeholder="email@exemplo.com" value={email}
            onChange={e => setEmail(e.target.value)} required
            style={{
              padding: "13px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: "0.9rem",
              outline: "none", fontFamily: "inherit"
            }}
          />
          <input
            type="password" placeholder="Senha (mín. 6 caracteres)" value={password}
            onChange={e => setPassword(e.target.value)} minLength={6} required
            style={{
              padding: "13px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: "0.9rem",
              outline: "none", fontFamily: "inherit"
            }}
          />
          <button
            type="submit" disabled={busy}
            style={{
              padding: "13px", borderRadius: 12, border: "none",
              background: busy ? "rgba(184,245,90,0.5)" : G,
              color: "#09090b", cursor: busy ? "default" : "pointer",
              fontSize: "0.9rem", fontWeight: 800, marginTop: 2
            }}
          >
            {busy ? "…" : mode === "signin" ? "Entrar com e-mail" : "Criar conta"}
          </button>
        </form>

        <button
          onClick={() => { setMode(m => m === "signin" ? "signup" : "signin"); setError(""); setMessage(""); }}
          style={{
            width: "100%", marginTop: 10, padding: "10px",
            background: "transparent", border: "none",
            color: "rgba(255,255,255,0.35)", cursor: "pointer",
            fontSize: "0.85rem"
          }}
        >
          {mode === "signin" ? "Não tenho conta — criar agora" : "Já tenho conta — entrar"}
        </button>

        {error && (
          <div style={{ marginTop: 12, padding: "11px 13px", borderRadius: 10,
            background: "rgba(255,128,128,0.08)", border: "1px solid rgba(255,128,128,0.2)",
            color: "#ff8080", fontSize: "0.85rem" }}>
            {error}
          </div>
        )}
        {message && (
          <div style={{ marginTop: 12, padding: "11px 13px", borderRadius: 10,
            background: "rgba(184,245,90,0.08)", border: "1px solid rgba(184,245,90,0.2)",
            color: G, fontSize: "0.85rem" }}>
            {message}
          </div>
        )}
      </div>
    </main>
  );
}

function InviteVerifyEmail({ user }: { user: User }) {
  const [checking, setChecking] = useState(false);

  async function refresh() {
    setChecking(true);
    await reload(user);
    if (auth.currentUser?.emailVerified) {
      window.location.reload();
    } else {
      setChecking(false);
    }
  }

  return (
    <main style={{
      minHeight: "100vh", background: "#09090b",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "24px 16px", fontFamily: "'Plus Jakarta Sans', sans-serif"
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ marginBottom: 32 }}><Logo /></div>

        <div style={{
          width: 52, height: 52, borderRadius: "50%",
          background: "rgba(184,245,90,0.08)",
          border: "1.5px solid rgba(184,245,90,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
          </svg>
        </div>

        <h1 style={{ margin: "0 0 8px", fontSize: "1.35rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.025em" }}>
          Confirme seu e-mail
        </h1>
        <p style={{ margin: "0 0 24px", color: "rgba(255,255,255,0.45)", fontSize: "0.9rem", lineHeight: 1.6 }}>
          Enviamos um link de confirmação para <strong style={{ color: "rgba(255,255,255,0.7)" }}>{user.email}</strong>.
          Confirme e depois clique no botão abaixo.
        </p>

        <button
          onClick={refresh} disabled={checking}
          style={{
            width: "100%", padding: "13px", borderRadius: 12,
            background: checking ? "rgba(184,245,90,0.5)" : G,
            color: "#09090b", border: "none", cursor: checking ? "default" : "pointer",
            fontSize: "0.9rem", fontWeight: 800
          }}
        >
          {checking ? "Verificando…" : "Já confirmei"}
        </button>
      </div>
    </main>
  );
}

function InviteShell({ error }: { error?: string }) {
  return (
    <main style={{
      minHeight: "100vh", background: "#09090b",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "24px 16px", fontFamily: "'Plus Jakarta Sans', sans-serif"
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ marginBottom: 32 }}><Logo /></div>
        {error ? (
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.9rem" }}>{error}</p>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 18, height: 18, borderRadius: "50%",
              border: `2px solid ${G}`, borderTopColor: "transparent",
              animation: "spin 0.7s linear infinite"
            }} />
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.9rem" }}>Abrindo convite…</span>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

function errorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  return "Não foi possível concluir agora.";
}
