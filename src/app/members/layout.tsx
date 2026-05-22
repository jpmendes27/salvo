import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Salvô! | membros",
};

export default function MembersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
