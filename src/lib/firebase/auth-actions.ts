"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminAuth } from "./admin";
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  createSessionCookieFromIdToken,
  ensureUserDocument,
} from "./auth-server";

/**
 * Exchanges a Firebase ID token (obtained client-side) for a server-managed
 * HTTP-only session cookie, and ensures the user document exists.
 */
export async function createSession(idToken: string): Promise<void> {
  const decoded = await getAdminAuth().verifyIdToken(idToken);
  const sessionCookie = await createSessionCookieFromIdToken(idToken);

  const store = await cookies();
  store.set({
    ...SESSION_COOKIE_OPTIONS,
    value: sessionCookie,
  });

  await ensureUserDocument({
    uid: decoded.uid,
    email: decoded.email ?? null,
    displayName: (decoded.name as string | undefined) ?? null,
    photoURL: (decoded.picture as string | undefined) ?? null,
  });
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
