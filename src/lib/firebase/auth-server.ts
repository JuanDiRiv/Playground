import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { getAdminAuth, getAdminDb } from "./admin";

export const SESSION_COOKIE_NAME = "tp_session";
const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 14 * 1000; // 14 days

export type SessionUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

/**
 * Reads the session cookie and verifies it. Returns the user or null.
 * Memoized per-request via React `cache`.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const sessionCookie = store.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await getAdminAuth().verifySessionCookie(
      sessionCookie,
      true,
    );
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      displayName: (decoded.name as string | undefined) ?? null,
      photoURL: (decoded.picture as string | undefined) ?? null,
    };
  } catch {
    return null;
  }
});

/** Creates a Firebase session cookie from a freshly-issued ID token. */
export async function createSessionCookieFromIdToken(
  idToken: string,
): Promise<string> {
  return getAdminAuth().createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_MS,
  });
}

export const SESSION_COOKIE_OPTIONS = {
  name: SESSION_COOKIE_NAME,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_MS / 1000,
};

/**
 * Ensures a `users/{uid}` document exists for the authenticated user.
 * Called on first sign-in.
 */
export async function ensureUserDocument(user: SessionUser): Promise<void> {
  const db = getAdminDb();
  const ref = db.collection("users").doc(user.uid);
  const snap = await ref.get();
  if (snap.exists) {
    await ref.update({
      lastLoginAt: new Date(),
      displayName: user.displayName,
      photoURL: user.photoURL,
      email: user.email,
    });
    return;
  }
  await ref.set({
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    createdAt: new Date(),
    lastLoginAt: new Date(),
    streakDays: 0,
    completedCount: 0,
  });
}
