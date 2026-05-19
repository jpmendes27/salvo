import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "fincheck pro | membros",
};

export default function MembersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
