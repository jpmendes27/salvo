import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "fincheck pro — convite",
};

export default function ConviteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
