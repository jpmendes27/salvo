import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Salvô! | transações",
};

export default function TransactionsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
