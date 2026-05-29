"use client";

import { useRouter } from "next/navigation";
import { PRIVACY_VERSION } from "@/lib/legal";

export default function PrivacyPage() {
  const router = useRouter();

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length <= 1) {
      router.push("/login");
    } else {
      router.back();
    }
  }

  return (
    <main className="page legal-doc">
      <button className="btn secondary" onClick={handleBack}>
        Voltar
      </button>
      <h1>Política de Privacidade</h1>
      <p className="muted">Versão {PRIVACY_VERSION}</p>

      <h2>1. Quem somos</h2>
      <p>
        O Salvô! é uma aplicação de gestão financeira pessoal e compartilhável.
        Tratamos dados como controladores para entregar o app, manter sua conta e proteger
        sua experiência.
      </p>

      <h2>2. Dados que coletamos</h2>
      <p>
        Coletamos nome, e-mail, identificador de autenticação, consentimentos, dados de
        workspace, membros convidados, categorias, lançamentos financeiros manuais e resumos
        gerados a partir desses lançamentos. Telefone e renda não fazem parte do onboarding
        inicial.
      </p>

      <h2>3. Finalidades e bases legais</h2>
      <p>
        Usamos seus dados para criar conta, autenticar acesso, operar workspaces financeiros,
        permitir convites, gerar resumos e registrar interesse em recursos futuros. As bases
        usadas são execução de contrato, consentimento quando aplicável, cumprimento de
        obrigações legais e legítimo interesse para segurança e melhoria do produto.
      </p>

      <h2>4. Compartilhamento dentro do workspace</h2>
      <p>
        Ao convidar alguém para um workspace, essa pessoa passa a ver e editar os dados
        financeiros daquele workspace como editor. O convite informa essa consequência antes
        do aceite.
      </p>

      <h2>5. Fornecedores</h2>
      <p>
        Usamos Firebase e Google para autenticação, banco de dados e hospedagem. Usamos
        Resend para envio de e-mails transacionais. Esses fornecedores processam dados para
        viabilizar o funcionamento do Salvô!.
      </p>

      <h2>5a. Uso de inteligência artificial</h2>
      <p>
        Para categorizar transações e gerar diagnósticos financeiros, o Salvô! envia dados
        de lançamentos financeiros para a API da Anthropic (Claude). Esses dados são
        processados exclusivamente para gerar as respostas exibidas no app e não são usados
        para treinar modelos. Consulte a política de privacidade da Anthropic em{" "}
        <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer">
          anthropic.com/privacy
        </a>
        .
      </p>

      <h2>5b. Transferência internacional de dados</h2>
      <p>
        Firebase, Google e Resend processam dados em servidores fora do Brasil. Esses
        fornecedores adotam mecanismos contratuais e certificações reconhecidos
        internacionalmente para garantir proteção equivalente à exigida pela LGPD.
      </p>

      <h2>6. Open Finance e WhatsApp</h2>
      <p>
        A v1 não acessa Open Finance real e não usa WhatsApp API. A fila de Open Finance
        registra apenas seu interesse, sem coletar credenciais ou dados bancários automáticos.
      </p>

      <h2>7. Direitos do titular</h2>
      <p>
        Você pode solicitar acesso, correção, exclusão, informações de compartilhamento,
        revogação de consentimento quando aplicável e demais direitos previstos na LGPD.
        Para isso, use a página de exclusão de conta ou entre em contato pelo e-mail{" "}
        {/* TODO: substituir pelo email real */}
        contato@salvô.app.
      </p>

      <h2>8. Retenção e exclusão</h2>
      <p>
        Mantemos dados enquanto sua conta ou workspace estiverem ativos, salvo obrigação legal
        ou necessidade de segurança. Owners podem excluir workspaces; membros podem sair de
        workspaces compartilhados.
      </p>
    </main>
  );
}
