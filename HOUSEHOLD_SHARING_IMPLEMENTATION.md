# Household Sharing Implementation Summary

## Overview
Implemented household invitation and sharing system for Basket Bot. Users can invite others to join their households via email, with role-based permissions (owner/editor/viewer).

## Database Changes

### New Table: HouseholdInvitation
```sql
CREATE TABLE "HouseholdInvitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "invitedEmail" TEXT NOT NULL COLLATE NOCASE,
    "invitedById" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "token" TEXT NOT NULL UNIQUE,
    "status" TEXT NOT NULL DEFAULT 'pending',  -- pending, accepted, declined
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("invitedById") REFERENCES "User" ("id") ON DELETE CASCADE
);
```

### New Indexes
- `HouseholdInvitation_token_idx` - Fast token lookup for accepting invitations
- `HouseholdInvitation_invitedEmail_status_idx` - Find pending invitations for a user
- `User_email_idx` - Case-insensitive email lookups

### Email Case-Insensitivity
- User.email now uses `COLLATE NOCASE` index for case-insensitive searches
- HouseholdInvitation.invitedEmail uses `COLLATE NOCASE` for email matching
- All email comparisons normalized to lowercase in application code

## Core Package Changes

### New Schemas (`packages/core/src/schemas/household.ts`)
- `invitationStatusSchema` - Enum: pending, accepted, declined
- `householdInvitationSchema` - Invitation entity
- `createInvitationRequestSchema` - Create invitation request (email + role)
- `acceptInvitationRequestSchema` - Accept invitation (token)
- `householdMemberDetailSchema` - Member with user details (name, email)
- `householdWithMembersSchema` - Household with member list
- `updateMemberRoleRequestSchema` - Update member role
- `invitationDetailSchema` - Invitation with household/inviter names

## Backend Implementation

### Repository Layer
- `householdRepo.ts` - CRUD operations for households and members
  - getUserHouseholds(), getHouseholdById(), createHousehold()
  - getHouseholdWithMembers(), updateHousehold(), deleteHousehold()
  - addMember(), removeMember(), updateMemberRole()
  - getHouseholdMembers(), getUserRole(), userIsMember()
  - countOwners() - For last-owner protection

- `invitationRepo.ts` - Invitation data access
  - createInvitation(), getInvitationByToken()
  - getUserPendingInvitations(), getHouseholdPendingInvitations()
  - updateInvitationStatus(), deleteInvitation()
  - isEmailInvitedOrMember() - Prevent duplicate invitations

### Service Layer
- `householdService.ts` - Business logic with authorization
  - Enforces role-based permissions (owners, editors, viewers)
  - Prevents removing/downgrading last owner
  - Validates household membership before operations

- `invitationService.ts` - Invitation business logic
  - createInvitation() - Only owners/editors can invite
  - acceptInvitation() - Adds user to household
  - declineInvitation() - Marks invitation declined
  - Validates email matches invitation before accepting/declining

### API Endpoints

#### Households
- `GET /api/households` - List user's households
- `POST /api/households` - Create household (becomes owner)
- `GET /api/households/[id]` - Get household with members
- `PUT /api/households/[id]` - Update name (owner only)
- `DELETE /api/households/[id]` - Delete household (owner only)

#### Members
- `GET /api/households/[id]/members` - List members
- `POST /api/households/[id]/members` - Create invitation (owner/editor)
- `PUT /api/households/[id]/members/[userId]` - Update role (owner only)
- `DELETE /api/households/[id]/members/[userId]` - Remove member (owner or self)

#### Invitations
- `GET /api/invitations` - List current user's pending invitations
- `POST /api/invitations/[token]/accept` - Accept invitation
- `POST /api/invitations/[token]/decline` - Decline invitation

## Authorization Rules

### Household Operations
- **Create**: Any authenticated user
- **View**: Any household member
- **Update**: Owners only
- **Delete**: Owners only

### Member Management
- **View members**: Any household member
- **Invite members**: Owners and editors
- **Change roles**: Owners only
- **Remove members**: Owners (any member) or self (leave)

### Protection Rules
- Cannot remove/downgrade the last owner
- Must transfer ownership before last owner can leave
- Cannot invite email already in household or with pending invitation

## Next Steps (Not Implemented Yet)

### Mobile App
1. Household context provider (stores activeHouseholdId)
2. Household picker UI (settings or app header)
3. Household settings page (member list, invite button)
4. Invitation modals (create, accept/decline)
5. Pending invitations display on home/settings page

### Admin Portal
1. Households list page (Mantine table)
2. Household detail page (members, created date)
3. Invitations monitoring page (pending invitations)

## Testing Checklist

### Database
- [ ] Run `pnpm db:init` to apply schema changes
- [ ] Verify HouseholdInvitation table created
- [ ] Verify indexes created
- [ ] Test case-insensitive email lookups

### API Testing
- [ ] Create household
- [ ] List user's households
- [ ] Get household details
- [ ] Update household name
- [ ] Create invitation
- [ ] List pending invitations for user
- [ ] Accept invitation
- [ ] Verify member added after accepting
- [ ] Decline invitation
- [ ] Change member role (owner only)
- [ ] Remove member
- [ ] Try to remove last owner (should fail)
- [ ] Delete household

### Edge Cases
- [ ] Invite same email twice (should fail)
- [ ] Invite email already a member (should fail)
- [ ] Non-owner tries to invite (should fail)
- [ ] Non-owner tries to change roles (should fail)
- [ ] Accept invitation for wrong email (should fail)
- [ ] Accept already-processed invitation (should fail)
- [ ] Remove last owner (should fail)
- [ ] Case-insensitive email matching works

## Dependencies

### Core Package
Must be rebuilt after schema changes:
```bash
pnpm --filter @basket-bot/core build
```

### Database Migration
Reset and reseed database:
```bash
cd apps/backend
pnpm db:init
```

## Notes
- **No expiration**: Invitations never expire (as specified)
- **No auto-create household**: Users start with no households (as specified)
- **App-only invitations**: No email delivery (can be added later)
- **Hard deletes**: Declined invitations kept for audit, but can be cleaned up
- **Always-online mobile**: No offline sync considerations
