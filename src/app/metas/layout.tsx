import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "fincheck pro — metas",
};

export default function MetasLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
