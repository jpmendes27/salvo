export type MemberRole = "owner" | "editor";
export type TransactionType = "income" | "expense";

export type Workspace = {
  id: string;
  name: string;
  createdBy: string;
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

export type Invite = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  createdBy: string;
  status: "active" | "revoked" | "accepted";
  expiresAt: unknown;
  createdAt?: unknown;
};
