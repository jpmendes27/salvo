import type { Metadata } from "next";
import { LandingEffects } from "./landing-effects";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "fincheck pro | o amigo rico que você nunca teve",
  description: "Um app que olha sua vida financeira do jeito que ela é, te fala a verdade na cara e te mostra um caminho real pra sair do sufoco. Sem planilha. Sem palavra difícil. Sem promessa furada.",
};

const css = `
  :root{--bg:#050505;--accent:#b8f55a;--fg:#ffffff;--muted:rgba(255,255,255,0.45);--line:rgba(255,255,255,0.08);--card:#111111;--card-2:#1a1a1a}
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth}
  html,body{background:#050505!important;color:#ffffff!important;font-family:'Inter Tight','Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;overflow-x:hidden}
  a{color:inherit;text-decoration:none}
  button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}
  ::selection{background:var(--accent);color:#050505}
  .wrap{max-width:1240px;margin:0 auto;padding:0 32px}
  @media(max-width:640px){.wrap{padding:0 22px}}

  /* content above canvas */
  header,section,footer{position:relative;z-index:1}

  /* scroll reveal */
  .reveal{opacity:0;transform:translateY(26px);transition:opacity .65s cubic-bezier(.16,1,.3,1),transform .65s cubic-bezier(.16,1,.3,1)}
  .reveal.visible{opacity:1;transform:none}
  .d1{transition-delay:.08s}
  .d2{transition-delay:.16s}
  .d3{transition-delay:.26s}
  .d4{transition-delay:.36s}

  /* hero entrance */
  @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
  .hero .pill{animation:fadeUp .75s cubic-bezier(.16,1,.3,1) both}
  .hero h1.hero-h{animation:fadeUp .75s .1s cubic-bezier(.16,1,.3,1) both}
  .hero .hero-sub{animation:fadeUp .75s .22s cubic-bezier(.16,1,.3,1) both}
  .hero .hero-cta{animation:fadeUp .75s .34s cubic-bezier(.16,1,.3,1) both}
  .hero .hero-meta{animation:fadeUp .75s .5s cubic-bezier(.16,1,.3,1) both}

  .logo{font-family:'DM Serif Display',serif;font-weight:400;letter-spacing:-0.02em;font-size:20px;line-height:1;display:inline-flex;align-items:flex-start;gap:0}
  .logo .fc{color:var(--accent)}
  .logo .pro{color:#fff}
  .logo .reg{font-family:'DM Mono',monospace;font-weight:400;font-size:0.42em;line-height:1;transform:translateY(2px);margin-left:2px;color:var(--accent)}

  nav.top{position:fixed;top:0;left:0;right:0;width:100%;z-index:50;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);background:rgba(5,5,5,0.6);border-bottom:1px solid rgba(255,255,255,0.07)}
  nav.top .inner{display:flex;align-items:center;justify-content:space-between;height:56px}
  nav.top .links{display:flex;gap:28px;align-items:center}
  nav.top .links a{color:var(--muted);font-size:13px;transition:color .2s ease}
  nav.top .links a:hover{color:#fff}
  .btn{display:inline-flex;align-items:center;gap:8px;padding:9px 18px;border-radius:999px;font-weight:600;font-size:13px;transition:transform .15s ease,background .2s ease,color .2s ease,border-color .2s ease;white-space:nowrap}
  .btn.primary{background:var(--accent);color:#050505}
  .btn.primary:hover{transform:translateY(-1px);background:#c8ff66}
  .btn.ghost{color:#fff;border:1px solid rgba(255,255,255,0.15)}
  .btn.ghost:hover{border-color:rgba(255,255,255,0.45)}
  .btn .arrow{display:inline-block;transition:transform .2s ease}
  .btn:hover .arrow{transform:translateX(3px)}
  @media(max-width:780px){nav.top .links{display:none}}

  .hero{position:relative;z-index:1;padding:110px 0 120px;margin-top:56px;overflow:hidden}
  .hero::before{content:"";position:absolute;inset:auto 0 -40% 0;height:80%;background:radial-gradient(60% 50% at 50% 0%,rgba(184,245,90,0.08),transparent 70%);pointer-events:none}
  .hero .grid-lines{position:absolute;inset:0;background-image:linear-gradient(to right,rgba(255,255,255,0.03) 1px,transparent 1px);background-size:96px 100%;mask-image:linear-gradient(to bottom,#000 0%,#000 70%,transparent 100%);-webkit-mask-image:linear-gradient(to bottom,#000 0%,#000 70%,transparent 100%);pointer-events:none}
  .pill{display:inline-flex;align-items:center;gap:10px;padding:8px 14px;border:1px solid var(--line);border-radius:999px;font-size:13px;color:var(--muted);background:rgba(255,255,255,0.02)}
  .pill .dot{width:6px;height:6px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 4px rgba(184,245,90,0.12)}
  h1.hero-h{font-family:'Inter Tight','Inter',system-ui,sans-serif;font-weight:700;font-size:clamp(48px,8.2vw,124px);line-height:1.05;letter-spacing:-0.03em;margin-top:28px;max-width:14ch;text-wrap:balance}
  h1.hero-h em{font-style:normal;color:var(--accent);font-weight:700}
  .hero-sub{margin-top:32px;max-width:58ch;color:rgba(255,255,255,0.7);font-size:clamp(17px,1.4vw,20px);line-height:1.55}
  .hero-cta{margin-top:42px;display:flex;gap:14px;flex-wrap:wrap;align-items:center}
  .hero-meta{margin-top:80px;display:grid;grid-template-columns:repeat(4,1fr);gap:24px;border-top:1px solid var(--line);padding-top:32px}
  .hero-meta .item .k{font-family:'Inter Tight','Inter',system-ui,sans-serif;font-weight:700;font-size:clamp(28px,3vw,44px);line-height:1.05;letter-spacing:-0.03em}
  .hero-meta .item .k em{font-style:normal;color:var(--accent);font-weight:700}
  .hero-meta .item .v{margin-top:10px;color:var(--muted);font-size:13px;line-height:1.4}
  @media(max-width:780px){.hero{padding:60px 0 80px}.hero-meta{grid-template-columns:repeat(2,1fr);gap:28px}h1.hero-h{margin-top:22px}}

  section{position:relative}
  .section{padding:120px 0}
  .eyebrow{display:inline-flex;align-items:center;gap:10px;color:var(--accent);font-family:'DM Mono',monospace;font-size:12px;letter-spacing:0.08em;text-transform:uppercase}
  .eyebrow::before{content:"";width:24px;height:1px;background:var(--accent)}
  .section-h{font-family:'Inter Tight','Inter',system-ui,sans-serif;font-weight:700;font-size:clamp(36px,5vw,68px);line-height:1.05;letter-spacing:-0.03em;margin-top:18px;max-width:18ch;text-wrap:balance}
  .section-h em{font-style:normal;color:var(--accent);font-weight:700}
  .section-lead{margin-top:22px;color:rgba(255,255,255,0.6);font-size:18px;line-height:1.55;max-width:55ch}
  @media(max-width:780px){.section{padding:80px 0}}

  .pain{border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
  .pain-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:0}
  .pain-item{padding:60px 36px;border-right:1px solid var(--line);display:flex;flex-direction:column;gap:24px;min-height:280px;position:relative}
  .pain-item:last-child{border-right:0}
  .pain-item .num{font-family:'DM Mono',monospace;color:var(--muted);font-size:13px}
  .pain-item .line{font-family:'Inter Tight','Inter',system-ui,sans-serif;font-weight:700;font-size:clamp(24px,2.4vw,34px);line-height:1.05;letter-spacing:-0.03em;text-wrap:balance}
  .pain-item .line em{font-style:normal;color:var(--accent);font-weight:700}
  .pain-item .foot{margin-top:auto;color:var(--muted);font-size:14px;line-height:1.5}
  @media(max-width:880px){.pain-grid{grid-template-columns:1fr}.pain-item{border-right:0;border-bottom:1px solid var(--line);min-height:auto;padding:44px 22px}.pain-item:last-child{border-bottom:0}}

  .how-head{display:flex;align-items:flex-end;justify-content:space-between;gap:40px;flex-wrap:wrap}
  .steps{margin-top:64px;display:grid;grid-template-columns:repeat(3,1fr);gap:24px;position:relative}
  .step{background:var(--card);border:1px solid var(--line);border-radius:22px;padding:30px;display:flex;flex-direction:column;gap:22px;min-height:380px;position:relative;overflow:hidden}
  .step .step-num{font-family:'DM Mono',monospace;font-size:12px;color:var(--muted);display:flex;align-items:center;justify-content:space-between}
  .step .step-num .badge{width:32px;height:32px;border-radius:50%;border:1px solid var(--line);display:inline-flex;align-items:center;justify-content:center;color:#fff;font-family:'Inter Tight','Inter',system-ui,sans-serif;font-weight:700;font-size:14px;letter-spacing:-0.02em}
  .step h3{font-family:'Inter Tight','Inter',system-ui,sans-serif;font-weight:700;font-size:30px;line-height:1.05;letter-spacing:-0.03em;text-wrap:balance}
  .step h3 em{font-style:normal;color:var(--accent);font-weight:700}
  .step p{color:var(--muted);font-size:15px;line-height:1.55}
  .step .visual{margin-top:auto;height:120px;border-radius:14px;background:var(--card-2);border:1px solid var(--line);position:relative;overflow:hidden;padding:14px;display:flex;flex-direction:column;justify-content:space-between}
  .files{display:flex;gap:8px;align-items:flex-end;height:100%}
  .file{flex:1;background:#0a0a0a;border:1px solid var(--line);border-radius:8px;padding:8px;height:100%;display:flex;flex-direction:column;justify-content:space-between;font-family:'DM Mono',monospace;font-size:10px;color:var(--muted)}
  .file .ftag{color:var(--accent)}
  .file:nth-child(2){transform:translateY(-6px)}
  .file:nth-child(3){transform:translateY(6px)}
  .ai-line{display:flex;justify-content:space-between;align-items:center;font-family:'DM Mono',monospace;font-size:11px;color:var(--muted)}
  .ai-line .v{color:#fff}
  .ai-line .neg{color:#ff7a59}
  .ai-line .pos{color:var(--accent)}
  .ai-bar{height:6px;background:#0a0a0a;border-radius:99px;overflow:hidden;position:relative;border:1px solid var(--line)}
  .ai-bar::after{content:"";position:absolute;inset:0;width:62%;background:var(--accent);border-radius:99px}
  .chat{display:flex;flex-direction:column;gap:8px}
  .bubble{align-self:flex-start;background:#0a0a0a;border:1px solid var(--line);border-radius:14px;border-bottom-left-radius:4px;padding:10px 14px;font-size:13px;color:#fff;max-width:90%;line-height:1.35}
  .bubble.me{align-self:flex-end;background:var(--accent);color:#050505;border:0;border-radius:14px;border-bottom-right-radius:4px;font-weight:500}
  @media(max-width:880px){.steps{grid-template-columns:1fr}.step{min-height:auto}}

  .features{margin-top:64px;display:grid;grid-template-columns:repeat(12,1fr);gap:24px}
  .feat{background:var(--card);border:1px solid var(--line);border-radius:24px;padding:36px;position:relative;overflow:hidden;display:flex;flex-direction:column;gap:24px;min-height:380px}
  .feat .ftop{display:flex;align-items:center;justify-content:space-between;color:var(--muted);font-family:'DM Mono',monospace;font-size:12px}
  .feat h3{font-family:'Inter Tight','Inter',system-ui,sans-serif;font-weight:700;font-size:34px;line-height:1.05;letter-spacing:-0.03em;max-width:14ch;text-wrap:balance}
  .feat h3 em{font-style:normal;color:var(--accent);font-weight:700}
  .feat .fdesc{color:var(--muted);font-size:15px;line-height:1.55;max-width:42ch}
  .feat--big{grid-column:span 7}
  .feat--reg{grid-column:span 5}
  .feat--wfull{grid-column:span 5}
  .feat--ai{grid-column:span 7}
  @media(max-width:980px){.feat--big,.feat--reg,.feat--wfull,.feat--ai{grid-column:span 12}}
  .vstage{margin-top:auto;background:var(--card-2);border:1px solid var(--line);border-radius:18px;padding:18px;position:relative;overflow:hidden;min-height:200px}
  .diag-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;font-family:'DM Mono',monospace;font-size:11px;color:var(--muted)}
  .diag-head .live{display:inline-flex;align-items:center;gap:6px;color:var(--accent)}
  .diag-head .live .d{width:6px;height:6px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 3px rgba(184,245,90,.18)}
  .diag-msg{background:#050505;border:1px solid var(--line);border-radius:14px;padding:14px 16px;font-family:'Inter Tight','Inter',system-ui,sans-serif;font-weight:700;font-size:18px;line-height:1.3;letter-spacing:-0.02em}
  .diag-msg em{font-style:normal;color:var(--accent);font-weight:700}
  .diag-msg .from{display:block;font-family:'DM Mono',monospace;font-style:normal;font-size:11px;color:var(--muted);margin-top:10px}
  .imp-row{display:flex;align-items:center;gap:10px;background:#050505;border:1px solid var(--line);border-radius:12px;padding:10px 14px;font-family:'DM Mono',monospace;font-size:12px;margin-bottom:8px}
  .imp-row .fmt{border:1px solid var(--accent);color:var(--accent);padding:2px 8px;border-radius:6px;font-size:10px}
  .imp-row .file-n{flex:1;color:#fff}
  .imp-row .ok{color:var(--accent)}
  .plan-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
  .plan-cell{background:#050505;border:1px solid var(--line);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px}
  .plan-cell .ph{font-family:'DM Mono',monospace;font-size:10px;color:var(--muted);display:flex;justify-content:space-between}
  .plan-cell .pv{font-family:'Inter Tight','Inter',system-ui,sans-serif;font-weight:700;font-size:22px;letter-spacing:-0.03em;line-height:1.05}
  .plan-cell .pv em{font-style:normal;color:var(--accent);font-weight:700}
  .pbar{height:5px;background:#1a1a1a;border-radius:99px;overflow:hidden;border:1px solid var(--line)}
  .pbar i{display:block;height:100%;background:var(--accent);border-radius:99px}
  .ws{display:flex;flex-direction:column;gap:10px}
  .ws-row{display:flex;align-items:center;gap:10px;padding:10px 12px;background:#050505;border:1px solid var(--line);border-radius:12px}
  .av{width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-family:'Inter Tight','Inter',system-ui,sans-serif;font-weight:700;font-size:13px;letter-spacing:-0.02em;color:#050505;background:var(--accent);flex-shrink:0}
  .av.b{background:#fff}
  .av.c{background:#1a1a1a;color:#fff;border:1px solid var(--line)}
  .ws-row .who{font-size:13px;color:#fff;flex:1}
  .ws-row .who span{color:var(--muted)}
  .ws-row .amt{font-family:'DM Mono',monospace;font-size:12px;color:var(--accent)}
  .ws-row .amt.neg{color:#ff7a59}

  .manifesto{padding:160px 0;text-align:center;border-top:1px solid var(--line);border-bottom:1px solid var(--line);position:relative}
  .manifesto::before{content:"";position:absolute;inset:0;background:radial-gradient(60% 50% at 50% 50%,rgba(184,245,90,0.05),transparent 70%);pointer-events:none}
  .manifesto .quote{font-family:'Inter Tight','Inter',system-ui,sans-serif;font-weight:700;font-size:clamp(40px,6.5vw,96px);line-height:1.05;letter-spacing:-0.03em;text-wrap:balance;max-width:18ch;margin:0 auto;position:relative}
  .manifesto .quote em{font-style:normal;color:var(--accent);font-weight:700}
  .manifesto .sig{margin-top:36px;display:inline-flex;align-items:center;gap:12px;color:var(--muted);font-family:'DM Mono',monospace;font-size:13px;letter-spacing:0.04em}
  .manifesto .sig::before,.manifesto .sig::after{content:"";width:36px;height:1px;background:var(--line)}

  .cta-final{padding:140px 0;text-align:center}
  .cta-final h2{font-family:'Inter Tight','Inter',system-ui,sans-serif;font-weight:700;font-size:clamp(48px,8vw,120px);line-height:1.05;letter-spacing:-0.03em;max-width:14ch;margin:0 auto;text-wrap:balance}
  .cta-final h2 em{font-style:normal;color:var(--accent);font-weight:700}
  .cta-final .sub{margin-top:24px;color:var(--muted);font-size:18px;line-height:1.5;max-width:42ch;margin-left:auto;margin-right:auto}
  .cta-final .btn{margin-top:44px;padding:18px 32px;font-size:16px}

  footer{border-top:1px solid var(--line);padding:48px 0 56px}
  footer .row{display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap}
  footer .small{color:var(--muted);font-size:13px;font-family:'DM Mono',monospace}
  footer .flinks{display:flex;gap:24px;flex-wrap:wrap}
  footer .flinks a{color:var(--muted);font-size:13px;transition:color .2s ease}
  footer .flinks a:hover{color:#fff}
`;

export default function LandingPage() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital,wght@0,400;1,400&family=DM+Mono:wght@300;400;500&family=Inter+Tight:ital,wght@0,300..800;1,300..800&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <LandingEffects />

      <nav className="top">
        <div className="wrap inner">
          <a href="#" className="logo" aria-label="fincheckpro">
            <span className="fc">fincheck</span><span className="pro">pro</span><span className="reg">®</span>
          </a>
          <div className="links">
            <a href="#dor">A real</a>
            <a href="#como">Como funciona</a>
            <a href="#features">Recursos</a>
            <a href="#manifesto">Manifesto</a>
          </div>
          <a className="btn primary" href={`${BASE}/login`}>Quero entrar <span className="arrow">→</span></a>
        </div>
      </nav>

      <header className="hero">
        <div className="grid-lines" />
        <div className="wrap" style={{ position: "relative" }}>
          <span className="pill"><span className="dot" /> Em fase de teste</span>
          <h1 className="hero-h">O amigo rico que <em>você nunca teve.</em></h1>
          <p className="hero-sub">Um app que olha sua vida financeira do jeito que ela é, te fala a verdade na cara e te mostra um caminho real pra sair do sufoco. Sem planilha. Sem palavra difícil. Sem promessa furada.</p>
          <div className="hero-cta">
            <a className="btn primary" href={`${BASE}/login`}>Quero entrar <span className="arrow">→</span></a>
            <a className="btn ghost" href="#como">Ver como funciona</a>
          </div>
          <div className="hero-meta">
            <div className="item">
              <div className="k"><em>3 min</em></div>
              <div className="v">Pra entender pra onde tá indo o seu dinheiro de verdade</div>
            </div>
            <div className="item">
              <div className="k">PDF · CSV · OFX</div>
              <div className="v">Joga o extrato do seu banco e a IA organiza tudo</div>
            </div>
            <div className="item">
              <div className="k">100% <em>BR</em></div>
              <div className="v">Feito pra realidade financeira do brasileiro</div>
            </div>
            <div className="item">
              <div className="k">WhatsApp</div>
              <div className="v">Alertas no zap, no lugar onde você já vive o dia</div>
            </div>
          </div>
        </div>
      </header>

      <section className="pain" id="dor">
        <div className="wrap reveal" style={{ paddingTop: "80px", paddingBottom: 0 }}>
          <span className="eyebrow">A real</span>
          <h2 className="section-h">A gente sabe <em>onde dói</em> — porque já passou por aí.</h2>
          <p className="section-lead">Não é falta de vontade. Não é preguiça. É que ninguém nunca te ensinou. E todo app que existe parece que foi feito pra outra pessoa, não pra você.</p>
        </div>
        <div className="pain-grid" style={{ marginTop: "64px" }}>
          <div className="pain-item reveal">
            <div className="num">01</div>
            <div className="line">Chega no dia <em>20</em> e você já não sabe pra onde foi o dinheiro.</div>
            <div className="foot">O salário entra, evapora, e no fim do mês fica aquela sensação ruim de quem foi roubado pela própria conta.</div>
          </div>
          <div className="pain-item reveal d1">
            <div className="num">02</div>
            <div className="line">Você até tentou planilha — durou <em>3 dias.</em></div>
            <div className="foot">Não é falta de força de vontade. Planilha foi feita pra contador, não pra quem só quer entender o que tá rolando.</div>
          </div>
          <div className="pain-item reveal d2">
            <div className="num">03</div>
            <div className="line">Ninguém nunca te ensinou — e <em>tá tudo bem.</em></div>
            <div className="foot">Educação financeira é coisa que escola não deu. A gente parte do zero, na sua linguagem, sem te julgar por nada.</div>
          </div>
        </div>
        <div style={{ height: "80px" }} />
      </section>

      <section className="section" id="como">
        <div className="wrap">
          <div className="how-head reveal">
            <div>
              <span className="eyebrow">Como funciona</span>
              <h2 className="section-h">Três passos. <em>Zero enrolação.</em></h2>
            </div>
            <p className="section-lead" style={{ marginTop: 0 }}>Não precisa configurar nada complicado. Não precisa lembrar de cadastrar gasto. Você só precisa querer.</p>
          </div>
          <div className="steps">
            <div className="step reveal">
              <div className="step-num">
                <span>Passo 01</span>
                <span className="badge">1</span>
              </div>
              <h3>Joga o extrato <em>aqui dentro.</em></h3>
              <p>Baixa o PDF, CSV ou OFX do seu banco e arrasta. Itaú, Nubank, Caixa, Bradesco, Inter — todos. Em segundos a gente lê tudo.</p>
              <div className="visual">
                <div className="files">
                  <div className="file"><span className="ftag">PDF</span><span>Itaú · 03/26</span></div>
                  <div className="file"><span className="ftag">OFX</span><span>Nubank · 03/26</span></div>
                  <div className="file"><span className="ftag">CSV</span><span>Caixa · 03/26</span></div>
                </div>
              </div>
            </div>
            <div className="step reveal d1">
              <div className="step-num">
                <span>Passo 02</span>
                <span className="badge">2</span>
              </div>
              <h3>A IA organiza tudo e <em>te conta a verdade.</em></h3>
              <p>Cada transação categorizada automaticamente. E o mais importante: um diagnóstico honesto de onde você tá vazando dinheiro.</p>
              <div className="visual">
                <div className="ai-line"><span>iFood · março</span><span className="neg">R$ 612</span></div>
                <div className="ai-bar" />
                <div className="ai-line"><span className="v">38% do que sobrou</span><span className="pos">priorizar</span></div>
              </div>
            </div>
            <div className="step reveal d2">
              <div className="step-num">
                <span>Passo 03</span>
                <span className="badge">3</span>
              </div>
              <h3>Recebe um plano <em>do tamanho da sua vida.</em></h3>
              <p>Meta real. Alcançável. Pensada pra quem ganha o que você ganha. E os lembretes chegam direto no seu WhatsApp.</p>
              <div className="visual">
                <div className="chat">
                  <div className="bubble">Bora? Hoje é dia de pagar a fatura sem deixar virar bola de neve.</div>
                  <div className="bubble me">Tô dentro 🙌</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="features" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="reveal">
            <span className="eyebrow">O que tem dentro</span>
            <h2 className="section-h">Tudo o que um <em>amigo rico</em> faria por você.</h2>
          </div>
          <div className="features">
            <div className="feat feat--ai reveal">
              <div className="ftop">
                <span>01 · Diagnóstico de IA</span>
                <span>· honesto</span>
              </div>
              <h3>A verdade na cara. <em>Sem filtro.</em></h3>
              <p className="fdesc">A IA do Fincheck olha pros seus gastos, identifica padrões e te conta o que você precisa ouvir — não o que você quer ouvir. Direto, popular, igual amigo de boteco que estudou finanças.</p>
              <div className="vstage">
                <div className="diag-head">
                  <span>Diagnóstico · março/2026</span>
                  <span className="live"><span className="d" /> ao vivo</span>
                </div>
                <div className="diag-msg">
                  Cara, você gastou <em>R$ 612 só em iFood</em> esse mês. Isso é mais do que a sua conta de luz e a internet juntas. Bora cozinhar de domingo?
                  <span className="from">— Fincheck IA</span>
                </div>
              </div>
            </div>
            <div className="feat feat--reg reveal d1">
              <div className="ftop">
                <span>02 · Importação</span>
                <span>· auto</span>
              </div>
              <h3>Joga o extrato. <em>Pronto.</em></h3>
              <p className="fdesc">PDF, CSV ou OFX de qualquer banco brasileiro. A gente lê, categoriza e organiza. Você não precisa cadastrar gasto na unha nunca mais.</p>
              <div className="vstage">
                <div className="imp-row"><span className="fmt">PDF</span><span className="file-n">itau_extrato_marco.pdf</span><span className="ok">✓ 247 lançamentos</span></div>
                <div className="imp-row"><span className="fmt">OFX</span><span className="file-n">nubank_03_2026.ofx</span><span className="ok">✓ 89 lançamentos</span></div>
                <div className="imp-row"><span className="fmt">CSV</span><span className="file-n">caixa_conta_corrente.csv</span><span className="ok">✓ 34 lançamentos</span></div>
              </div>
            </div>
            <div className="feat feat--wfull reveal d2">
              <div className="ftop">
                <span>03 · Planejamento</span>
                <span>· real</span>
              </div>
              <h3>Metas que <em>cabem no seu bolso.</em></h3>
              <p className="fdesc">Nada de meta absurda de juntar R$ 50 mil em 6 meses. A gente olha o que entra e o que sai, e te dá um plano honesto pro mês.</p>
              <div className="vstage">
                <div className="plan-grid">
                  <div className="plan-cell">
                    <div className="ph"><span>Mercado</span><span>R$ 420 / 600</span></div>
                    <div className="pv"><em>70%</em></div>
                    <div className="pbar"><i style={{ width: "70%" }} /></div>
                  </div>
                  <div className="plan-cell">
                    <div className="ph"><span>Guardar</span><span>R$ 180 / 300</span></div>
                    <div className="pv"><em>60%</em></div>
                    <div className="pbar"><i style={{ width: "60%" }} /></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="feat feat--big reveal d3">
              <div className="ftop">
                <span>04 · Workspace</span>
                <span>· família/casal</span>
              </div>
              <h3>A casa toda <em>no mesmo barco.</em></h3>
              <p className="fdesc">Casal, família, irmão dividindo aluguel — todo mundo vê o mesmo painel em tempo real. Acabou a fofoca de quem gastou o quê. E os recorrentes (aluguel, luz, internet) chegam no WhatsApp pra todo mundo.</p>
              <div className="vstage">
                <div className="ws">
                  <div className="ws-row"><span className="av">M</span><span className="who">Maria <span>· mercado da semana</span></span><span className="amt neg">−R$ 142</span></div>
                  <div className="ws-row"><span className="av b">J</span><span className="who">João <span>· transferiu pra poupança</span></span><span className="amt">+R$ 200</span></div>
                  <div className="ws-row"><span className="av c">+1</span><span className="who">Lembrete <span>· aluguel vence em 3 dias</span></span><span className="amt neg">R$ 1.250</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="manifesto" id="manifesto">
        <div className="wrap" style={{ position: "relative" }}>
          <p className="quote reveal">A gente não veio te ensinar a <em>investir.</em><br />Veio te ajudar a parar de fazer <em>merda</em> com o seu dinheiro.</p>
          <div className="sig reveal d1">manifesto fincheck pro</div>
        </div>
      </section>

      <section className="cta-final">
        <div className="wrap">
          <h2 className="reveal">Bora colocar a sua vida <em>em ordem?</em></h2>
          <p className="sub reveal d1">Dois minutos pra entrar. Zero risco — você só vai ganhar paz.</p>
          <a className="btn primary reveal d2" href={`${BASE}/login`}>Começar agora <span className="arrow">→</span></a>
        </div>
      </section>

      <footer>
        <div className="wrap row">
          <a href="#" className="logo" style={{ fontSize: "18px" }}>
            <span className="fc">fincheck</span><span className="pro">pro</span><span className="reg">®</span>
          </a>
          <div className="flinks">
            <a href="#dor">A real</a>
            <a href="#como">Como funciona</a>
            <a href="#features">Recursos</a>
            <a href={`${BASE}/login`}>Entrar no beta</a>
          </div>
          <div className="small">© 2026 · feito pra quem ganha de 1,5k a 4k</div>
        </div>
      </footer>
    </>
  );
}
