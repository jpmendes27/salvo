import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Salvô! | categorias",
};

export default function TopCategoriesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
