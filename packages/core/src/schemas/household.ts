import { z } from "zod";
import { MAX_EMAIL_LENGTH, MAX_NAME_LENGTH } from "../constants/index.js";
import { minMaxLengthString } from "./zodHelpers.js";

// Household member roles
export const householdRoleSchema = z.enum(["owner", "editor", "viewer"]);
export type HouseholdRole = z.infer<typeof householdRoleSchema>;

// Household schemas
export const householdSchema = z.object({
    id: z.string().uuid(),
    name: minMaxLengthString(1, MAX_NAME_LENGTH, "Name"),
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
    name: minMaxLengthString(1, MAX_NAME_LENGTH, "Name"),
});

export type CreateHouseholdRequest = z.infer<typeof createHouseholdRequestSchema>;

export const updateHouseholdRequestSchema = z.object({
    name: minMaxLengthString(1, MAX_NAME_LENGTH, "Name").optional(),
});

export type UpdateHouseholdRequest = z.infer<typeof updateHouseholdRequestSchema>;

export const addHouseholdMemberRequestSchema = z.object({
    userId: z.string().uuid(),
    role: householdRoleSchema,
});

export type AddHouseholdMemberRequest = z.infer<typeof addHouseholdMemberRequestSchema>;

// Invitation status (only pending - accepted/declined invitations are deleted)
export const invitationStatusSchema = z.enum(["pending"]);
export type InvitationStatus = z.infer<typeof invitationStatusSchema>;

// Household invitation schemas
export const householdInvitationSchema = z.object({
    id: z.string().uuid(),
    householdId: z.string().uuid(),
    invitedEmail: z
        .string()
        .email()
        .max(MAX_EMAIL_LENGTH, { message: `Email must be ${MAX_EMAIL_LENGTH} characters or less` }),
    invitedById: z.string().uuid(),
    role: householdRoleSchema,
    token: z.string().uuid(),
    status: invitationStatusSchema,
    createdAt: z.date(),
});

export type HouseholdInvitation = z.infer<typeof householdInvitationSchema>;

export const createInvitationRequestSchema = z.object({
    email: z
        .string()
        .email()
        .max(MAX_EMAIL_LENGTH, { message: `Email must be ${MAX_EMAIL_LENGTH} characters or less` }),
    role: householdRoleSchema,
});

export type CreateInvitationRequest = z.infer<typeof createInvitationRequestSchema>;

export const acceptInvitationRequestSchema = z.object({
    token: z.string().uuid(),
});

export type AcceptInvitationRequest = z.infer<typeof acceptInvitationRequestSchema>;

// Detailed household with members
export const householdMemberDetailSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    userName: z
        .string()
        .max(MAX_NAME_LENGTH, { message: `Name must be ${MAX_NAME_LENGTH} characters or less` }),
    userEmail: z
        .string()
        .email()
        .max(MAX_EMAIL_LENGTH, { message: `Email must be ${MAX_EMAIL_LENGTH} characters or less` }),
    role: householdRoleSchema,
    createdAt: z.date(),
});

export type HouseholdMemberDetail = z.infer<typeof householdMemberDetailSchema>;

export const householdWithMembersSchema = householdSchema.extend({
    members: z.array(householdMemberDetailSchema),
});

export type HouseholdWithMembers = z.infer<typeof householdWithMembersSchema>;

// Update member role request
export const updateMemberRoleRequestSchema = z.object({
    role: householdRoleSchema,
});

export type UpdateMemberRoleRequest = z.infer<typeof updateMemberRoleRequestSchema>;

// Invitation detail (with household name and inviter name)
export const invitationDetailSchema = householdInvitationSchema.extend({
    householdName: z.string(),
    inviterName: z.string(),
});

export type InvitationDetail = z.infer<typeof invitationDetailSchema>;
