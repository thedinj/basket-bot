import type {
    Household,
    HouseholdMember,
    HouseholdMemberDetail,
    HouseholdWithMembers,
} from "@basket-bot/core";
import { randomUUID } from "crypto";
import { db } from "../db/db";

/**
 * Get all households a user is a member of
 */
export function getUserHouseholds(userId: string): Household[] {
    const rows = db
        .prepare(
            `SELECT h.id, h.name, h.createdById, h.updatedById, h.createdAt, h.updatedAt
             FROM Household h
             JOIN HouseholdMember hm ON h.id = hm.householdId
             WHERE hm.userId = ?
             ORDER BY h.createdAt DESC`
        )
        .all(userId) as any[];

    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        createdById: row.createdById,
        updatedById: row.updatedById,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
    }));
}

/**
 * Get a household by ID
 */
export function getHouseholdById(householdId: string): Household | null {
    const row = db
        .prepare(
            `SELECT id, name, createdById, updatedById, createdAt, updatedAt
             FROM Household
             WHERE id = ?`
        )
        .get(householdId) as any;

    if (!row) return null;

    return {
        id: row.id,
        name: row.name,
        createdById: row.createdById,
        updatedById: row.updatedById,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
    };
}

/**
 * Get household with all members (with user details)
 */
export function getHouseholdWithMembers(householdId: string): HouseholdWithMembers | null {
    const household = getHouseholdById(householdId);
    if (!household) return null;

    const memberRows = db
        .prepare(
            `SELECT hm.id, hm.userId, hm.createdAt, u.name as userName, u.email as userEmail
             FROM HouseholdMember hm
             JOIN User u ON hm.userId = u.id
             WHERE hm.householdId = ?
             ORDER BY hm.createdAt ASC`
        )
        .all(householdId) as any[];

    const members: HouseholdMemberDetail[] = memberRows.map((row) => ({
        id: row.id,
        userId: row.userId,
        userName: row.userName,
        userEmail: row.userEmail,
        createdAt: new Date(row.createdAt),
    }));

    return {
        ...household,
        members,
    };
}

/**
 * Create a new household
 */
export function createHousehold(params: { name: string; userId: string }): Household {
    const householdId = randomUUID();
    const now = new Date().toISOString();

    db.prepare(
        `INSERT INTO Household (id, name, createdById, updatedById, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)`
    ).run(householdId, params.name, params.userId, params.userId, now, now);

    // Add creator as household member
    const memberId = randomUUID();
    db.prepare(
        `INSERT INTO HouseholdMember (id, householdId, userId, createdAt)
         VALUES (?, ?, ?, ?)`
    ).run(memberId, householdId, params.userId, now);

    return {
        id: householdId,
        name: params.name,
        createdById: params.userId,
        updatedById: params.userId,
        createdAt: new Date(now),
        updatedAt: new Date(now),
    };
}

/**
 * Update household name
 */
export function updateHousehold(params: {
    householdId: string;
    name: string;
    updatedById: string;
}): Household | null {
    const now = new Date().toISOString();

    const result = db
        .prepare(
            `UPDATE Household
             SET name = ?, updatedById = ?, updatedAt = ?
             WHERE id = ?`
        )
        .run(params.name, params.updatedById, now, params.householdId);

    if (result.changes === 0) return null;

    return getHouseholdById(params.householdId);
}

/**
 * Delete a household (cascades to members, stores, etc.)
 */
export function deleteHousehold(householdId: string): boolean {
    const result = db.prepare(`DELETE FROM Household WHERE id = ?`).run(householdId);
    return result.changes > 0;
}

/**
 * Add a member to a household
 */
export function addMember(params: { householdId: string; userId: string }): HouseholdMember {
    const memberId = randomUUID();
    const now = new Date().toISOString();

    db.prepare(
        `INSERT INTO HouseholdMember (id, householdId, userId, createdAt)
         VALUES (?, ?, ?, ?)`
    ).run(memberId, params.householdId, params.userId, now);

    return {
        id: memberId,
        householdId: params.householdId,
        userId: params.userId,
        createdAt: new Date(now),
    };
}

/**
 * Remove a member from a household
 */
export function removeMember(householdId: string, userId: string): boolean {
    const result = db
        .prepare(`DELETE FROM HouseholdMember WHERE householdId = ? AND userId = ?`)
        .run(householdId, userId);
    return result.changes > 0;
}

/**
 * Update a member's role
 */
/**
 * Get household members
 */
export function getHouseholdMembers(householdId: string): HouseholdMemberDetail[] {
    const rows = db
        .prepare(
            `SELECT hm.id, hm.userId, hm.createdAt, u.name as userName, u.email as userEmail
             FROM HouseholdMember hm
             JOIN User u ON hm.userId = u.id
             WHERE hm.householdId = ?
             ORDER BY hm.createdAt ASC`
        )
        .all(householdId) as any[];

    return rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        userName: row.userName,
        userEmail: row.userEmail,
        createdAt: new Date(row.createdAt),
    }));
}

/**
 * Check if a user is a member of a household
 */
export function userIsMember(householdId: string, userId: string): boolean {
    const row = db
        .prepare(
            `SELECT 1
             FROM HouseholdMember
             WHERE householdId = ? AND userId = ?`
        )
        .get(householdId, userId);

    return !!row;
}

/**
 * Count members in a household
 */
export function countMembers(householdId: string): number {
    const row = db
        .prepare(
            `SELECT COUNT(*) as count
             FROM HouseholdMember
             WHERE householdId = ?`
        )
        .get(householdId) as any;

    return row.count;
}
