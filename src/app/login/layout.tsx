import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Salvô! | login",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
