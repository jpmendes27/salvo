// ─── Centralized error handling ──────────────────────────────────────────────
//
// getUserFacingError(err, context) is the ONLY function that should produce
// user-visible error strings. Rules:
//   • Returns a friendly Portuguese message — never English, JSON, stack trace,
//     request_id, provider name, billing details, or HTTP status.
//   • Logs the full technical error to console.error (never to the screen).
//   • For operational errors (API quota, key invalid, etc.) sends a one-shot
//     admin e-mail via Resend — throttled to 1 per 15 min per context.
//
// Callers are still responsible for firing analytics events (login_error, etc.)
// with the error_code they extract themselves — to avoid double-firing.

export type ErrorContext =
  | "login"
  | "signup"
  | "import"
  | "diagnosis"
  | "goal"
  | "data"
  | "verify"
  | "onboarding"
  | "generic";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractCode(err: unknown): string {
  return (err as { code?: string })?.code ?? "";
}

function extractRaw(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try { return JSON.stringify(err); } catch { return "unknown"; }
}

// Patterns that indicate the error is our problem (infra/billing), not the user's
const OPERATIONAL = /credit.?balance|billing|upgrade.*credits|invalid.?api.?key|authentication_error|invalid_request_error|overloaded|rate.?limit|anthropic/i;

function isOperational(raw: string): boolean {
  return OPERATIONAL.test(raw);
}

// ─── Admin alert via Resend ───────────────────────────────────────────────────
// Requires NEXT_PUBLIC_RESEND_KEY and NEXT_PUBLIC_RESEND_FROM in .env.local.
// Throttled to 1 alert per 15 min per context (localStorage).

const ALERT_TTL = 15 * 60 * 1000;

function shouldAlert(context: ErrorContext): boolean {
  try {
    const key = `__salvo_alrt_${context}`;
    const last = Number(localStorage.getItem(key) ?? 0);
    if (Date.now() - last < ALERT_TTL) return false;
    localStorage.setItem(key, String(Date.now()));
    return true;
  } catch { return false; }
}

async function adminAlert(raw: string, context: ErrorContext): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_RESEND_KEY;
  const from   = process.env.NEXT_PUBLIC_RESEND_FROM;
  if (!apiKey || !from) return; // not configured → skip silently
  if (!shouldAlert(context)) return;

  const requestId = raw.match(/"request_id":"([^"]+)"/)?.[1] ?? "—";

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: "salvo@jpmendes.com",
        subject: `[Salvô! 🚨] Erro operacional — ${context}`,
        html: [
          `<p><b>Contexto:</b> ${context}</p>`,
          `<p><b>Erro (truncado):</b> ${raw.slice(0, 500)}</p>`,
          `<p><b>Request ID:</b> ${requestId}</p>`,
          `<p><b>Timestamp:</b> ${new Date().toISOString()}</p>`,
          `<p style="color:#888;font-size:12px">Nenhum dado pessoal ou financeiro incluído.</p>`,
        ].join(""),
      }),
    });
  } catch { /* alert must never crash the app */ }
}

// ─── Context-specific mappers ─────────────────────────────────────────────────

const GENERIC = "Algo deu errado por aqui. Tenta de novo — se continuar, fala com a gente.";
const OFFLINE  = "Não consegui te conectar agora. Tenta de novo em instantes.";

function mapLogin(code: string, raw: string): string {
  if (/unavailable|network|offline|fetch|load failed|failed to fetch/i.test(raw)) return OFFLINE;
  switch (code) {
    // Anti-enumeration: all "wrong credentials" cases → same message
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-login-credentials":
    case "auth/invalid-email":
    case "auth/user-disabled":
      return "E-mail ou senha não conferem. Tenta de novo.";
    case "auth/too-many-requests":
      return "Muitas tentativas seguidas. Espera um minuto e tenta de novo.";
    default:
      return OFFLINE;
  }
}

function mapSignup(code: string): string {
  switch (code) {
    // Anti-enumeration: email-already-in-use MUST return the same message as invalid-email
    // so an attacker cannot probe whether an address exists in the database.
    case "auth/email-already-in-use":
    case "auth/invalid-email":
      return "Esse e-mail não parece certo. Confere e tenta de novo.";
    case "auth/weak-password":
      return "A senha precisa de pelo menos 6 caracteres.";
    case "auth/too-many-requests":
      return "Muitas tentativas seguidas. Espera um minuto e tenta de novo.";
    default:
      return OFFLINE;
  }
}

function mapImport(raw: string): string {
  if (isOperational(raw))
    return "Não consegui processar o arquivo agora. Tenta de novo em alguns minutos.";
  if (/password|encrypt|protect/i.test(raw))
    return "Esse PDF tá protegido por senha. Tira a senha e envia de novo.";
  if (/too.?large|size.?limit|413|payload.?too/i.test(raw))
    return "Esse arquivo é grande demais. Tenta enviar um mês por vez.";
  if (/network|offline|fetch|load.?failed|timeout|CORS/i.test(raw))
    return "A conexão caiu no meio do envio. Confere sua internet e tenta de novo.";
  if (/no.?transactions|zero.?transactions|nenhuma/i.test(raw))
    return "Não achei transações nesse arquivo. Confere se é o extrato certo e envia de novo.";
  if (/corrupt|invalid.?file|unsupported.?format/i.test(raw))
    return "Não consegui abrir esse arquivo. Exporta o extrato em PDF, CSV ou OFX e tenta de novo.";
  return "Não consegui processar o arquivo agora. Tenta de novo em alguns minutos.";
}

function mapData(code: string, raw: string): string {
  if (code === "unavailable" || /unavailable|offline|network/i.test(raw))
    return "Você tá sem conexão. Seus dados voltam quando a internet voltar.";
  if (code === "permission-denied")
    return "Você não tem acesso a isso.";
  if (code === "not-found")
    return "Não consegui carregar seus dados agora. Puxa pra atualizar.";
  return "Não consegui salvar agora. Tenta de novo.";
}

function mapVerify(raw: string): string {
  if (/send|network|fetch|envio/i.test(raw))
    return "Não consegui enviar o código agora. Tenta de novo em alguns minutos.";
  return "Código inválido. Confere e tenta de novo.";
}

function mapOnboarding(code: string): string {
  if (code === "permission-denied") return "Você não tem acesso a isso.";
  return "Não consegui salvar agora. Tenta de novo.";
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function getUserFacingError(err: unknown, context: ErrorContext): string {
  const code = extractCode(err);
  const raw  = extractRaw(err);

  // Technical log — console only, never the screen
  console.error(`[salvo:${context}]`, code || "—", raw);

  // Admin alert for operational failures (quota, billing, key)
  if (isOperational(raw)) {
    adminAlert(raw, context);
  }

  switch (context) {
    case "login":      return mapLogin(code, raw);
    case "signup":     return mapSignup(code);
    case "import":     return mapImport(raw);
    case "diagnosis":  return "O diagnóstico não carregou agora. Atualiza em alguns minutos.";
    case "goal":       return "Não consegui sugerir uma meta agora. Tenta de novo daqui a pouco.";
    case "data":       return mapData(code, raw);
    case "verify":     return mapVerify(raw);
    case "onboarding": return mapOnboarding(code);
    default:           return GENERIC;
  }
}
