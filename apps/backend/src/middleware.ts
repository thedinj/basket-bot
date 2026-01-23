import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
    // Handle CORS for API routes
    if (request.nextUrl.pathname.startsWith("/api")) {
        // Handle preflight OPTIONS request
        if (request.method === "OPTIONS") {
            return new NextResponse(null, {
                status: 200,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
                    "Access-Control-Expose-Headers": "X-Token-Status",
                    "Access-Control-Max-Age": "86400",
                },
            });
        }

        // Add CORS headers to actual requests
        const response = NextResponse.next();
        response.headers.set("Access-Control-Allow-Origin", "*");
        response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
        response.headers.set("Access-Control-Expose-Headers", "X-Token-Status");
        return response;
    }

    return NextResponse.next();
}

export const config = {
    matcher: "/api/:path*",
};
