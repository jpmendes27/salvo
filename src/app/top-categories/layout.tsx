import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "fincheck pro — categorias",
};

export default function TopCategoriesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
