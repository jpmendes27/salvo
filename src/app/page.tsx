"use client";

import { useEffect } from "react";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function RootPage() {
  useEffect(() => {
    window.location.replace(`${BASE}/login`);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#050505" }} />
  );
}
