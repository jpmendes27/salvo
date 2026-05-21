"use client";

import { MoreHorizontal } from "lucide-react";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "@/lib/categories";

interface Props {
  categoria: string;
  size?: number;
  radius?: number;
}

export function CategoryAvatar({ categoria, size = 36, radius = 10 }: Props) {
  const Icon = CATEGORY_ICONS[categoria] ?? MoreHorizontal;
  const bg = CATEGORY_COLORS[categoria] ?? "#6b7080";
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Icon size={size * 0.5} color="#fff" strokeWidth={1.75} />
    </div>
  );
}
