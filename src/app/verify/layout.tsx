import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Salvô! | verificação",
};

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
