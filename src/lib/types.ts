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
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type MonthlySummary = {
  income: number;
  expense: number;
  balance: number;
  savingsRate: number;
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
  status: "active" | "revoked" | "accepted";
  expiresAt: unknown;
  createdAt?: unknown;
};
