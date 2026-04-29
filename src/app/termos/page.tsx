import Link from "next/link";
import { TERMS_VERSION } from "@/lib/legal";

export default function TermsPage() {
  return (
    <main className="page legal-doc">
      <Link className="btn secondary" href="/">
        Voltar
      </Link>
      <h1>Termos de Uso</h1>
      <p className="muted">Versao {TERMS_VERSION}</p>

      <h2>1. Uso do produto</h2>
      <p>
        O Fincheck Pro ajuda voce a registrar lancamentos financeiros, acompanhar meses e
        gerar resumos. O app nao substitui consultoria financeira, contabil, juridica ou
        recomendacao de investimento.
      </p>

      <h2>2. Conta e seguranca</h2>
      <p>
        Voce pode entrar com Google ou e-mail e senha. Contas criadas por e-mail precisam
        confirmar o e-mail antes de acessar dados reais. Voce e responsavel por manter suas
        credenciais protegidas.
      </p>

      <h2>3. Workspaces compartilhados</h2>
      <p>
        Dados financeiros pertencem ao workspace. Ao criar link de convite, o owner autoriza
        que outra pessoa entre como editor, podendo ver e editar lancamentos e resumos.
      </p>

      <h2>4. Responsabilidades</h2>
      <p>
        Voce deve inserir informacoes verdadeiras e usar o produto de forma licita. O Fincheck
        Pro pode bloquear acessos abusivos, fraudulentos ou que comprometam a seguranca do app.
      </p>

      <h2>5. Recursos futuros</h2>
      <p>
        Open Finance, WhatsApp API, planos pagos e automacoes podem ser adicionados no futuro
        mediante termos, avisos ou consentimentos especificos quando necessario.
      </p>

      <h2>6. Exclusao</h2>
      <p>
        Owners podem excluir workspaces. Em workspaces compartilhados, a exclusao remove dados
        usados por outros membros, por isso a v1 exige confirmacao forte antes dessa acao.
      </p>
    </main>
  );
}
