import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Salvô! | projeção",
};

export default function ProjecaoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
