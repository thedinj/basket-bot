import { NextRequest, NextResponse } from "next/server";
import { createUserRequestSchema } from "@basket-bot/core";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email, name, password } = createUserRequestSchema.parse(body);

        // Check if user exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return NextResponse.json(
                { code: "CONFLICT", message: "User with this email already exists" },
                { status: 409 }
            );
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create user
        const user = await prisma.user.create({
            data: {
                email,
                name,
                password: hashedPassword,
                scopes: "",
            },
        });

        return NextResponse.json(
            {
                id: user.id,
                email: user.email,
                name: user.name,
                scopes: [],
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Registration error:", error);
        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Internal server error" },
            { status: 500 }
        );
    }
}
