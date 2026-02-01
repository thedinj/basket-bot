import { withAuth } from "@/lib/auth/withAuth";
import { getAllUsers } from "@/lib/repos/userRepo";
import { NextResponse } from "next/server";

export const GET = withAuth(
    async () => {
        try {
            const users = getAllUsers();

            return NextResponse.json({ users });
        } catch (error) {
            console.error("Error fetching users:", error);
            return NextResponse.json(
                { code: "INTERNAL_ERROR", message: "Failed to fetch users" },
                { status: 500 }
            );
        }
    },
    { requireScopes: ["admin"] }
);
