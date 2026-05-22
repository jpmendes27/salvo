import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Salvô! | onboarding",
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
