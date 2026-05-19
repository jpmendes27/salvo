import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "fincheck pro | login",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
