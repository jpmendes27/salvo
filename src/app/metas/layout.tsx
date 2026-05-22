import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Salvô! | metas",
};

export default function MetasLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
