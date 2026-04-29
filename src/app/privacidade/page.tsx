import Link from "next/link";
import { PRIVACY_VERSION } from "@/lib/legal";

export default function PrivacyPage() {
  return (
    <main className="page legal-doc">
      <Link className="btn secondary" href="/">
        Voltar
      </Link>
      <h1>Politica de Privacidade</h1>
      <p className="muted">Versao {PRIVACY_VERSION}</p>

      <h2>1. Quem somos</h2>
      <p>
        O Fincheck Pro e uma aplicacao de gestao financeira pessoal e compartilhavel.
        Tratamos dados como controladores para entregar o app, manter sua conta e proteger
        sua experiencia.
      </p>

      <h2>2. Dados que coletamos</h2>
      <p>
        Coletamos nome, e-mail, identificador de autenticacao, consentimentos, dados de
        workspace, membros convidados, categorias, lancamentos financeiros manuais e resumos
        gerados a partir desses lancamentos. Telefone e renda nao fazem parte do onboarding
        inicial.
      </p>

      <h2>3. Finalidades e bases legais</h2>
      <p>
        Usamos seus dados para criar conta, autenticar acesso, operar workspaces financeiros,
        permitir convites, gerar resumos e registrar interesse em recursos futuros. As bases
        usadas sao execucao de contrato, consentimento quando aplicavel, cumprimento de
        obrigacoes legais e legitimo interesse para seguranca e melhoria do produto.
      </p>

      <h2>4. Compartilhamento dentro do workspace</h2>
      <p>
        Ao convidar alguem para um workspace, essa pessoa passa a ver e editar os dados
        financeiros daquele workspace como editor. O convite informa essa consequencia antes
        do aceite.
      </p>

      <h2>5. Fornecedores</h2>
      <p>
        Usamos Firebase e Google para autenticacao, banco de dados e hospedagem. Esses
        fornecedores processam dados para viabilizar o funcionamento do Fincheck Pro.
      </p>

      <h2>6. Open Finance e WhatsApp</h2>
      <p>
        A v1 nao acessa Open Finance real e nao usa WhatsApp API. A fila de Open Finance
        registra apenas seu interesse, sem coletar credenciais ou dados bancarios automaticos.
      </p>

      <h2>7. Direitos do titular</h2>
      <p>
        Voce pode solicitar acesso, correcao, exclusao, informacoes de compartilhamento,
        revogacao de consentimento quando aplicavel e demais direitos previstos na LGPD.
        Para isso, use a pagina de exclusao de conta ou o canal de contato indicado no app.
      </p>

      <h2>8. Retencao e exclusao</h2>
      <p>
        Mantemos dados enquanto sua conta ou workspace estiverem ativos, salvo obrigacao legal
        ou necessidade de seguranca. Owners podem excluir workspaces; membros podem sair de
        workspaces compartilhados.
      </p>
    </main>
  );
}
