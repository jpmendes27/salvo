export type MemberRole = "owner" | "editor";
export type TransactionType = "income" | "expense";

export type Workspace = {
  id: string;
  name: string;
  createdBy: string;
  monthlyIncome?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type Member = {
  id: string;
  uid: string;
  workspaceId: string;
  role: MemberRole;
  status: "active" | "left";
  displayName: string;
  email: string;
  createdBy?: string;
  inviteId?: string;
  joinedAt?: unknown;
};

export type Category = {
  id: string;
  name: string;
  color: string;
  type: TransactionType | "both";
};

export type Parcela = { atual: number; total: number };

export type Transaction = {
  id: string;
  type: TransactionType;
  description: string;
  amount: number;
  category: string;
  date: string;
  monthKey: string;
  createdBy: string;
  createdByName: string;
  sourceLabel?: string;
  source?: "account" | "card";
  // Card-only fields (source === "card"): which card and statement period this
  // belongs to, and installment info when the purchase is parcelada.
  cardId?: string;
  faturaPeriod?: string; // YYYY-MM of the statement
  parcela?: Parcela;
  // Reconciliation status of an imported transaction. ABSENT = verified by the
  // system (the common case — no extra write). Only stamped when the import did
  // not reconcile ("nao_conferido"), and flipped to "atestado_usuario" when the
  // user confirms it's right. importId groups the transactions of one import.
  verification?: "nao_conferido" | "atestado_usuario";
  importId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type PlannedItemStatus = "planned" | "paid" | "skipped";

export type PlannedItem = {
  id: string;
  type: TransactionType;
  title: string;
  amount: number;
  category: string;
  dueDay: number;
  monthKey: string;
  status: PlannedItemStatus;
  createdBy: string;
  createdByName: string;
  linkedTransactionId?: string;
  recurringId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type RecorrenciaInfo = {
  tipo: "infinita" | "parcelada";
  totalMeses: number | null;
  mesInicio: string;
};

export type RecurringItem = {
  id: string;
  type: TransactionType;
  title: string;
  amount: number;
  category: string;
  dueDay: number;
  active: boolean;
  createdBy: string;
  createdByName: string;
  recorrencia?: RecorrenciaInfo;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type MonthlySummary = {
  income: number;
  expense: number;
  balance: number;
  savingsRate: number | null;
  accountExpense: number;
  cardExpense: number;
  topCategory?: string;
  topCategoryAmount?: number;
  insights: string[];
  shareText: string;
};

export type GoalType = "reserva" | "viagem" | "divida" | "investimento" | "outro";

export type Goal = {
  id: string;
  title: string;
  type: GoalType;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  monthlyContribution?: number;
  status: "active" | "completed";
  createdBy: string;
  createdByName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type Invite = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  createdBy: string;
  createdByName?: string;
  canal?: string;
  guestPhone?: string;
  guestEmail?: string;
  status: "active" | "revoked" | "accepted";
  expiresAt: unknown;
  createdAt?: unknown;
};

// ─── Credit card (separate lens from cash flow) ──────────────────────────────

export type Card = {
  id: string;            // deterministic: bank+last4 normalized
  bank: string;
  name: string;          // e.g. "Nubank Gold"
  last4?: string;
  limitTotal?: number;
  limitUsado?: number;
  limitDisponivel?: number;
  closingDay?: number;   // dia de fechamento
  dueDay?: number;       // dia de vencimento
  createdBy: string;
  createdByName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type Fatura = {
  id: string;            // deterministic: cardId_period
  cardId: string;
  period: string;        // YYYY-MM
  saldoAnterior: number;
  totalDespesas: number;
  totalPagamentos: number;
  totalCreditos: number;
  totalAPagar: number;   // saldo desta fatura
  vencimento?: string;   // YYYY-MM-DD
  createdAt?: unknown;
  updatedAt?: unknown;
};
