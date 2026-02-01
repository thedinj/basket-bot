import { withAuth } from "@/lib/auth/withAuth";
import { getAllUsers } from "@/lib/repos/userRepo";
import { db } from "@/lib/db/db";
import { NextRequest, NextResponse } from "next/server";

export const GET = withAuth(async (req: NextRequest, { params }: { params: Promise<Record<string, string>> }) => {
    try {
        const resolvedParams = await params;
        const type = resolvedParams.type;
        const limit = 100;

        let data: any[] = [];
        let columns: string[] = [];

        switch (type) {
            case "users":
                data = getAllUsers().slice(0, limit);
                columns = ["email", "name", "scopes", "createdAt"];
                break;

            case "stores":
                data = db
                    .prepare(
                        `SELECT s.id, s.name, s.createdAt, s.updatedAt,
                                u.email as createdBy
                         FROM Store s
                         JOIN User u ON s.createdById = u.id
                         ORDER BY s.createdAt DESC
                         LIMIT ?`
                    )
                    .all(limit) as any[];
                columns = ["name", "createdBy", "createdAt"];
                break;

            case "store-items":
                data = db
                    .prepare(
                        `SELECT si.id, si.name, s.name as storeName,
                                si.usageCount, si.isFavorite, si.isHidden,
                                si.createdAt, si.updatedAt
                         FROM StoreItem si
                         JOIN Store s ON si.storeId = s.id
                         ORDER BY si.createdAt DESC
                         LIMIT ?`
                    )
                    .all(limit) as any[];
                columns = ["name", "storeName", "usageCount", "isFavorite", "createdAt"];
                break;

            case "shopping-list-items":
                data = db
                    .prepare(
                        `SELECT sli.id, si.name as itemName, s.name as storeName,
                                sli.qty, qu.abbreviation as unit,
                                sli.isChecked, sli.notes,
                                sli.createdAt, sli.updatedAt
                         FROM ShoppingListItem sli
                         LEFT JOIN StoreItem si ON sli.storeItemId = si.id
                         JOIN Store s ON sli.storeId = s.id
                         LEFT JOIN QuantityUnit qu ON sli.unitId = qu.id
                         ORDER BY sli.createdAt DESC
                         LIMIT ?`
                    )
                    .all(limit) as any[];
                columns = ["itemName", "storeName", "qty", "unit", "isChecked", "createdAt"];
                break;

            default:
                return NextResponse.json(
                    { code: "INVALID_TYPE", message: "Invalid data type" },
                    { status: 400 }
                );
        }

        return NextResponse.json({ data, columns, type });
    } catch (error) {
        console.error("Error fetching data:", error);
        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Failed to fetch data" },
            { status: 500 }
        );
    }
}, { requireScopes: ["admin"] });
