# Next Steps: Testing the Household Sharing Implementation

## ⚠️ IMPORTANT: Build Core Package First

The backend currently shows TypeScript errors because the core package needs to be rebuilt with the new types:

```bash
# From repository root
pnpm --filter @basket-bot/core build
```

After this command completes, all TypeScript errors in the backend should resolve.

## Reset Database with New Schema

```bash
cd apps/backend
pnpm db:init
```

This will:

1. Drop existing tables
2. Create new schema (including HouseholdInvitation table)
3. Create indexes for case-insensitive email lookups
4. Reseed with admin user and sample data

## Testing the API

### 1. Create a Household

```bash
POST /api/households
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "My Household"
}
```

### 2. Invite Someone

```bash
POST /api/households/<household_id>/members
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "email": "friend@example.com",
  "role": "editor"
}

# Returns invitation with token
```

### 3. Check Pending Invitations (as invited user)

```bash
GET /api/invitations
Authorization: Bearer <invited_user_access_token>

# Returns list of pending invitations
```

### 4. Accept Invitation

```bash
POST /api/invitations/<token>/accept
Authorization: Bearer <invited_user_access_token>
```

### 5. View Household Members

```bash
GET /api/households/<household_id>/members
Authorization: Bearer <access_token>
```

### 6. Change Member Role (owner only)

```bash
PUT /api/households/<household_id>/members/<user_id>
Authorization: Bearer <owner_access_token>
Content-Type: application/json

{
  "role": "viewer"
}
```

### 7. Remove Member

```bash
DELETE /api/households/<household_id>/members/<user_id>
Authorization: Bearer <owner_access_token>
```

## What Still Needs to Be Built

### ✅ Completed: Mobile App Household Management

The mobile app household management has been fully implemented in the settings slide-out menu:

**Implemented Features:**

1. **Household Context** (`src/households/`)
    - ✅ HouseholdContext.tsx
    - ✅ HouseholdProvider.tsx
    - ✅ useHousehold.ts
    - ✅ Integrated into Main.tsx

2. **Settings Page Integration** (`src/components/settings/Settings.tsx`)
    - ✅ Displays current household name
    - ✅ Manage Members button
    - ✅ Invite Someone button
    - ✅ My Invitations button with badge showing pending count

3. **Modals**
    - ✅ InviteMemberModal.tsx - Email + role picker form
    - ✅ HouseholdMembersModal.tsx - Member list with role management and removal
    - ✅ HouseholdInvitationsModal.tsx - Accept/decline pending invitations

4. **API Client** (`src/lib/api/household.ts`)
    - ✅ All household and invitation API methods
    - ✅ Integrated with TanStack Query patterns

**How It Works:**

- HouseholdProvider wraps the authenticated app and loads user's households on mount
- Active household is stored in Capacitor Preferences and syncs with RemoteDatabase
- Settings menu shows household section with current household name
- Badge on "My Invitations" button shows count of pending invitations
- Owners can manage members (change roles, remove members)
- All members can invite others (owners/editors)
- Users see pending invitations and can accept/decline

### ⏭️ Still To Do (Future Work)

#### Household Switching

- Add household picker/switcher (not implemented yet)
- Allow users to switch between multiple households
- Could be added to settings or app header

### ~Admin Portal~ (Skipped per user request)

Read-only inspection pages:

1. **Households List** (`admin/households/page.tsx`)
    - Table: name, member count, created date
    - Mantine Table component

2. **Household Detail** (`admin/households/[id]/page.tsx`)
    - Household info
    - Member list with emails/roles

3. **Invitations** (`admin/invitations/page.tsx`)
    - Pending invitations table
    - Filter by household or status

## Verification Checklist

After building core and resetting database:

- [ ] No TypeScript errors in backend
- [ ] Database has HouseholdInvitation table
- [ ] Indexes created (check with SQLite browser)
- [ ] Admin user seeded with household
- [ ] Can create new household via API
- [ ] Can invite member via API
- [ ] Can list pending invitations
- [ ] Can accept invitation
- [ ] Member appears in household after accepting
- [ ] Owner can change member role
- [ ] Owner can remove member
- [ ] Cannot remove last owner (gets error)
- [ ] Non-owner cannot change roles (gets 403)
- [ ] Case-insensitive email matching works

## Implementation Time Estimates

### ✅ Mobile UI (COMPLETED)

- Household context: ✅ Done
- API client integration: ✅ Done
- Settings page integration: ✅ Done
- Invitation modals: ✅ Done
- Pending invitations UI with badge: ✅ Done
- Member management modal: ✅ Done

### Future Enhancements

- Household switching UI: 1-2 hours
- Create new household flow: 1-2 hours

## Known Limitations

1. **No email notifications**: Invited users must check app for invitations
2. **No expiration**: Invitations never expire
3. **No bulk operations**: Must invite one user at a time
4. **No audit log**: Cannot see who invited whom historically
5. **No household icons/colors**: Only names displayed

These can be added in future iterations if needed.
