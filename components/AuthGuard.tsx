"use client";

import { useAuth } from "@/hooks/useAuth";
import { ReactNode } from "react";

export default function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, signIn } = useAuth();

  if (!isAuthenticated) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Please sign in</h2>
        <button onClick={signIn}>Sign in with Microsoft</button>
      </div>
    );
  }

  return <>{children}</>;
}