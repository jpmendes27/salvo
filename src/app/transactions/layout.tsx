import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "fincheck pro — transações",
};

export default function TransactionsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
