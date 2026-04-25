"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { createSession } from "@/lib/firebase/auth-actions";

type Props = {
    redirectTo?: string;
};

export function LoginForm({ redirectTo }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    async function handleGoogleSignIn() {
        setError(null);
        try {
            const auth = getFirebaseAuth();
            const provider = new GoogleAuthProvider();
            const credential = await signInWithPopup(auth, provider);
            const idToken = await credential.user.getIdToken();

            startTransition(async () => {
                await createSession(idToken);
                router.replace(
                    redirectTo && redirectTo.startsWith("/") ? redirectTo : "/dashboard",
                );
                router.refresh();
            });
        } catch (err) {
            console.error(err);
            setError(
                err instanceof Error ? err.message : "Sign-in failed. Try again.",
            );
        }
    }

    return (
        <div className="space-y-3">
            <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isPending}
                className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-bg px-4 py-2.5 text-sm font-medium text-fg transition hover:border-border-strong disabled:opacity-50"
            >
                <GoogleIcon />
                {isPending ? "Signing in…" : "Continue with Google"}
            </button>

            {error ? (
                <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                    {error}
                </p>
            ) : null}
        </div>
    );
}

function GoogleIcon() {
    return (
        <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden>
            <path
                fill="#FFC107"
                d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.3 0-11.5-5.2-11.5-11.5S17.7 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.7 6.4 29.1 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c10.8 0 19.5-8.7 19.5-19.5 0-1.2-.1-2.3-.4-3.5z"
            />
            <path
                fill="#FF3D00"
                d="M6.3 14.7l6.6 4.8C14.8 16 19 13 24 13c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.7 6.9 29.1 5 24 5 16.3 5 9.6 9.4 6.3 14.7z"
            />
            <path
                fill="#4CAF50"
                d="M24 43c5 0 9.6-1.9 13.1-5l-6-5C29.2 34.4 26.7 35.5 24 35.5c-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.5 38.5 16.2 43 24 43z"
            />
            <path
                fill="#1976D2"
                d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6 5C40.6 35 43.5 30 43.5 24c0-1.2-.1-2.3-.4-3.5z"
            />
        </svg>
    );
}
