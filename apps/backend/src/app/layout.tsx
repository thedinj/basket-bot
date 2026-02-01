import type { Metadata } from "next";
import { ColorSchemeScript } from "@mantine/core";
import "@mantine/core/styles.css";
import "./globals.scss";

export const metadata: Metadata = {
    title: "Basket Bot",
    description: "Shopping list management system",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <head>
                <ColorSchemeScript defaultColorScheme="auto" />
            </head>
            <body suppressHydrationWarning>{children}</body>
        </html>
    );
}
