import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Salvô! | convite",
};

export default function ConviteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
