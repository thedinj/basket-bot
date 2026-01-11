import type { Metadata } from "next";
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
            <body>{children}</body>
        </html>
    );
}
