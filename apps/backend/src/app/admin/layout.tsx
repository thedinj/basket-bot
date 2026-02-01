"use client";

import AdminSessionProvider from "@/lib/admin/AdminSessionProvider";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { MantineProvider } from "@mantine/core";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const ProtectedAdminContent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
        <MantineProvider
            defaultColorScheme="auto"
            theme={{
                primaryColor: "violet",
                colors: {
                    violet: [
                        "#f5f3ff",
                        "#ede9fe",
                        "#ddd6fe",
                        "#c4b5fd",
                        "#9f7aea",
                        "#6b46c1",
                        "#6b46c1",
                        "#5b3ba1",
                        "#4c3181",
                        "#3d2661",
                    ],
                },
            }}
        >
            <AdminSessionProvider>
                <ProtectedAdminContent>{children}</ProtectedAdminContent>
            </AdminSessionProvider>
        </MantineProvider>
    );
}
