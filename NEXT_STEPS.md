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

### Mobile App (`apps/mobile/`)
The backend is complete, but the mobile UI is not implemented yet:

1. **Household Context** (`src/households/`)
   - HouseholdContext.tsx
   - HouseholdProvider.tsx
   - useHousehold.ts
   - Wraps app to provide activeHouseholdId

2. **Household Picker UI**
   - Add to settings page or app header
   - Dropdown/modal to switch between households
   - Display current household name

3. **Household Settings Page** (`src/pages/HouseholdSettingsPage.tsx`)
   - List members with roles
   - Invite button
   - Role change/remove buttons (owner only)

4. **Invitation Modals**
   - InviteMemberModal.tsx (email + role picker)
   - ChangeMemberRoleModal.tsx
   - RemoveMemberConfirmModal.tsx

5. **Pending Invitations Display**
   - Show on home page or settings
   - Accept/decline buttons
   - Notification badge

6. **API Client Methods** (`src/lib/api/`)
   - Add methods for all household/invitation endpoints
   - Integrate with TanStack Query

### Admin Portal (`apps/backend/src/app/admin/`)
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

### Mobile UI (High Priority)
- Household context: 1-2 hours
- Household picker: 1 hour
- Settings page + member list: 2-3 hours
- Invitation modals: 2-3 hours
- Pending invitations UI: 1-2 hours
- API client integration: 1-2 hours
- **Total: ~10-15 hours**

### Admin UI (Lower Priority)
- Households list: 2 hours
- Household detail: 1-2 hours
- Invitations page: 1-2 hours
- **Total: ~4-6 hours**

## Known Limitations

1. **No email notifications**: Invited users must check app for invitations
2. **No expiration**: Invitations never expire
3. **No bulk operations**: Must invite one user at a time
4. **No audit log**: Cannot see who invited whom historically
5. **No household icons/colors**: Only names displayed

These can be added in future iterations if needed.
