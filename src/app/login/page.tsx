import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/firebase/auth-server";
import { LoginForm } from "./login-form";

export default async function LoginPage({
    searchParams,
}: {
    searchParams: Promise<{ from?: string }>;
}) {
    const user = await getSessionUser();
    const { from } = await searchParams;

    if (user) {
        redirect(from && from.startsWith("/") ? from : "/dashboard");
    }

    return (
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-6 py-12">
            <div className="rounded-2xl border border-border bg-bg-elevated p-8 shadow-2xl shadow-black/40">
                <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
                <p className="mt-1 text-sm text-fg-muted">
                    Use your Google account to start practicing.
                </p>

                <div className="mt-6">
                    <Suspense>
                        <LoginForm redirectTo={from} />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}
