"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, logout } from "@/lib/api";
import { clearLogin, readToken } from "@/lib/browserSession";
import type { SessionUser } from "@/types/app";

export function useCurrentUser() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  useEffect(() => {
    if (!readToken()) {
      router.replace("/login");
      return;
    }
    getSession()
      .then((session) => setUser(session.user))
      .catch(() => {
        clearLogin();
        router.replace("/login");
      });
  }, [router]);

  async function signOut() {
    await logout().catch(() => null);
    clearLogin();
    router.replace("/login");
  }

  return { user, setUser, signOut };
}
