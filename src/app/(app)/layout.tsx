import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/firebase/auth-server";

/**
 * Authenticated layout for the protected app shell.
 * Performs server-side session verification with the Admin SDK.
 */
export default async function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = await getSessionUser();
    if (!user) {
        redirect("/login");
    }

    return <div className="mx-auto w-full max-w-7xl px-6 py-8">{children}</div>;
}
