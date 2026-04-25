import Image from "next/image";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/firebase/auth-server";
import { signOut } from "@/lib/firebase/auth-actions";

export default async function ProfilePage() {
    const user = await getSessionUser();
    if (!user) redirect("/login");

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>

            <div className="flex items-center gap-4 rounded-2xl border border-border bg-bg-elevated p-5">
                {user.photoURL ? (
                    <Image
                        src={user.photoURL}
                        alt={user.displayName ?? "User avatar"}
                        width={64}
                        height={64}
                        className="rounded-full"
                    />
                ) : (
                    <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-purple-500 text-xl font-bold text-white">
                        {(user.displayName ?? user.email ?? "?").slice(0, 1).toUpperCase()}
                    </div>
                )}
                <div>
                    <div className="font-semibold">{user.displayName ?? "Anonymous"}</div>
                    <div className="text-sm text-fg-muted">{user.email}</div>
                    <div className="mt-1 text-xs text-fg-subtle">UID: {user.uid}</div>
                </div>
            </div>

            <form action={signOut}>
                <button
                    type="submit"
                    className="rounded-lg border border-border bg-bg-elevated px-4 py-2 text-sm font-medium text-fg transition hover:border-danger hover:text-danger"
                >
                    Sign out
                </button>
            </form>
        </div>
    );
}
