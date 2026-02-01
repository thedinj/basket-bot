"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MantineProvider } from "@mantine/core";
import AdminSessionProvider from "@/lib/admin/AdminSessionProvider";
import { useAdminSession } from "@/lib/admin/useAdminSession";

const ProtectedAdminContent: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const { user, isLoading } = useAdminSession();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!isLoading && !user && pathname !== "/admin/login") {
            router.push("/admin/login");
        }
    }, [user, isLoading, pathname, router]);

    // Allow login page without auth
    if (pathname === "/admin/login") {
        return <>{children}</>;
    }

    // Show loading or nothing while checking auth
    if (isLoading || !user) {
        return null;
    }

    return <>{children}</>;
};

export default function AdminLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <MantineProvider defaultColorScheme="auto">
            <AdminSessionProvider>
                <ProtectedAdminContent>{children}</ProtectedAdminContent>
            </AdminSessionProvider>
        </MantineProvider>
    );
}
