"use client";

import { Component, ReactNode, ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

// Last-resort crash net. Shows a friendly screen instead of a blank page.
// Only catches errors that bubble all the way up (component render crashes).
// Per-feature errors should be handled locally and never reach here.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[salvo:crash]", error.message, info.componentStack?.slice(0, 300));
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#050505",
          color: "#fff",
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 320 }}>
          <p
            style={{
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              marginBottom: 8,
            }}
          >
            Algo deu errado por aqui.
          </p>
          <p
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.45)",
              lineHeight: 1.6,
              marginBottom: 28,
            }}
          >
            Tenta de novo — se continuar, fala com a gente.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "11px 24px",
              background: "#b8f55a",
              color: "#000",
              border: "none",
              borderRadius: 10,
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 14,
              letterSpacing: "-0.01em",
            }}
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}
