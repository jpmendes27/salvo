"use client";

import { useRouter } from "next/navigation";
import { TERMS_VERSION } from "@/lib/legal";

export default function TermsPage() {
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
      <h1>Termos de Uso</h1>
      <p className="muted">Versão {TERMS_VERSION}</p>

      <h2>1. Uso do produto</h2>
      <p>
        O Salvô! ajuda você a registrar lançamentos financeiros, acompanhar meses e
        gerar resumos. O app não substitui consultoria financeira, contábil, jurídica ou
        recomendação de investimento.
      </p>
      <p>
        As informações exibidas no app são organizadas a partir dos dados inseridos pelo
        próprio usuário. O Salvô! não se responsabiliza por decisões financeiras tomadas
        com base nessas informações. A responsabilidade pelas escolhas é sempre do usuário.
      </p>
      <p>
        O Salvô! é destinado a maiores de 18 anos. Ao criar uma conta, você declara ter
        pelo menos 18 anos.
      </p>

      <h2>2. Conta e segurança</h2>
      <p>
        Você pode entrar com Google ou e-mail e senha. Contas criadas por e-mail precisam
        confirmar o e-mail antes de acessar dados reais. Você é responsável por manter suas
        credenciais protegidas.
      </p>

      <h2>2a. Seus dados são seus</h2>
      <p>
        Os dados financeiros inseridos no Salvô! pertencem ao usuário. O Salvô! não vende,
        não aluga e não usa seus dados para fins publicitários.
      </p>

      <h2>3. Workspaces compartilhados</h2>
      <p>
        Dados financeiros pertencem ao workspace. Ao criar link de convite, o owner autoriza
        que outra pessoa entre como editor, podendo ver e editar lançamentos e resumos.
      </p>

      <h2>4. Responsabilidades</h2>
      <p>
        Você deve inserir informações verdadeiras e usar o produto de forma lícita. O Salvô!
        pode bloquear acessos abusivos, fraudulentos ou que comprometam a segurança do app.
        O app pode conter erros de categorização automática ou de leitura de extratos. Sempre
        confira os dados importados antes de tomar decisões com base neles.
      </p>

      <h2>5. Recursos futuros</h2>
      <p>
        Open Finance, WhatsApp API, planos pagos e automações podem ser adicionados no futuro
        mediante termos, avisos ou consentimentos específicos quando necessário.
      </p>

      <h2>6. Exclusão</h2>
      <p>
        Owners podem excluir workspaces. Em workspaces compartilhados, a exclusão remove dados
        usados por outros membros, por isso a v1 exige confirmação forte antes dessa ação.
        Alterações relevantes nestes termos serão comunicadas por e-mail ou notificação no
        app com pelo menos 10 dias de antecedência.
      </p>

      <h2>7. Exclusão de conta e dados pessoais</h2>
      <p>
        Você pode solicitar a exclusão da sua conta a qualquer momento diretamente pelo app,
        na tela de configurações da conta.
      </p>
      <p>Ao confirmar a exclusão:</p>
      <ul>
        <li>Seu acesso é encerrado imediatamente e você é desconectado do app.</li>
        <li>Uma solicitação formal é registrada e enviada para nossa equipe.</li>
        <li>
          Seus dados (perfil, transações e workspace) são removidos permanentemente
          do nosso sistema em até 30 dias corridos.
        </li>
        <li>
          Todos os membros do workspace também perdem o acesso — o workspace
          é excluído junto com a conta do owner.
        </li>
        <li>Após a exclusão, não é possível recuperar nenhuma informação.</li>
      </ul>
      <p>
        Dúvidas sobre exclusão de dados? Fale com a gente:{" "}
        <a href="mailto:salvo@jpmendes.com">salvo@jpmendes.com</a>
      </p>
    </main>
  );
}
