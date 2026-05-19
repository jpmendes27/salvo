import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "fincheck pro — onboarding",
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
