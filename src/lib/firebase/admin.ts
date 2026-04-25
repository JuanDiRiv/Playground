// Note: this module is intended for server use only. It is imported by
// auth-server.ts and auth-actions.ts which both carry the `server-only`
// marker; this file omits it so that Node scripts (e.g. scripts/seed.ts)
// can import it directly. firebase-admin itself is Node-only and cannot
// run in the browser.
import {
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Server-only Firebase Admin SDK singleton.
 *
 * Credentials resolution order:
 *  1. FIREBASE_ADMIN_SERVICE_ACCOUNT_B64 (base64-encoded service account JSON)
 *  2. FIREBASE_ADMIN_PROJECT_ID + FIREBASE_ADMIN_CLIENT_EMAIL + FIREBASE_ADMIN_PRIVATE_KEY
 */
type RawServiceAccount = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
};

function normalizeServiceAccount(raw: RawServiceAccount): ServiceAccount {
  const projectId = raw.projectId ?? raw.project_id;
  const clientEmail = raw.clientEmail ?? raw.client_email;
  const privateKey = (raw.privateKey ?? raw.private_key)?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin service account is missing project_id / client_email / private_key.",
    );
  }

  return { projectId, clientEmail, privateKey };
}

function loadServiceAccount(): ServiceAccount {
  const b64 = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_B64;
  if (b64) {
    const json = JSON.parse(
      Buffer.from(b64, "base64").toString("utf-8"),
    ) as RawServiceAccount;
    return normalizeServiceAccount(json);
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin credentials missing. Set FIREBASE_ADMIN_SERVICE_ACCOUNT_B64 or the trio FIREBASE_ADMIN_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY.",
    );
  }

  return normalizeServiceAccount({ projectId, clientEmail, privateKey });
}

let cachedApp: App | null = null;

export function getAdminApp(): App {
  if (cachedApp) return cachedApp;
  cachedApp =
    getApps()[0] ??
    initializeApp({
      credential: cert(loadServiceAccount()),
    });
  return cachedApp;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}
