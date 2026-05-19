import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "fincheck pro — projeção",
};

export default function ProjecaoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
