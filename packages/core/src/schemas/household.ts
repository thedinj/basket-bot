import { z } from "zod";

// Household member roles
export const householdRoleSchema = z.enum(["owner", "editor", "viewer"]);
export type HouseholdRole = z.infer<typeof householdRoleSchema>;

// Household schemas
export const householdSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    createdById: z.string().uuid(),
    updatedById: z.string().uuid(),
    createdAt: z.date(),
    updatedAt: z.date(),
});

export type Household = z.infer<typeof householdSchema>;

export const householdMemberSchema = z.object({
    id: z.string().uuid(),
    householdId: z.string().uuid(),
    userId: z.string().uuid(),
    role: householdRoleSchema,
    createdAt: z.date(),
});

export type HouseholdMember = z.infer<typeof householdMemberSchema>;

export const createHouseholdRequestSchema = z.object({
    name: z.string().min(1),
});

export type CreateHouseholdRequest = z.infer<typeof createHouseholdRequestSchema>;

export const updateHouseholdRequestSchema = z.object({
    name: z.string().min(1).optional(),
});

export type UpdateHouseholdRequest = z.infer<typeof updateHouseholdRequestSchema>;

export const addHouseholdMemberRequestSchema = z.object({
    userId: z.string().uuid(),
    role: householdRoleSchema,
});

export type AddHouseholdMemberRequest = z.infer<typeof addHouseholdMemberRequestSchema>;
