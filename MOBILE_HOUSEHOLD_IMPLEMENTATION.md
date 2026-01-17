# Mobile Household Sharing Implementation - Complete

## Summary

Successfully implemented household sharing UI in the mobile app's settings slide-out menu. Users can now manage household members, send invitations, and respond to pending invitations directly from the app.

## What Was Built

### 1. Household Context (`apps/mobile/src/households/`)

Created a three-file context pattern following the app's conventions:

- **HouseholdContext.tsx** - Type definitions and context creation
- **HouseholdProvider.tsx** - Provider implementation with state management
- **useHousehold.ts** - Consumer hook

The provider:

- Loads user's households on mount and when authentication changes
- Tracks active household ID in Capacitor Preferences
- Syncs active household with RemoteDatabase
- Provides pending invitations count for badge display
- Auto-selects first household if none is active

### 2. API Client (`apps/mobile/src/lib/api/household.ts`)

Complete API integration:

**Household API:**

- getUserHouseholds()
- getHouseholdWithMembers(id)
- createHousehold(name)
- updateHousehold(id, name)
- deleteHousehold(id)
- getHouseholdMembers(id)
- createInvitation(householdId, email, role)
- updateMemberRole(householdId, userId, role)
- removeMember(householdId, userId)

**Invitation API:**

- getUserPendingInvitations()
- acceptInvitation(token)
- declineInvitation(token)

### 3. Settings Page Integration (`apps/mobile/src/components/settings/Settings.tsx`)

Added Household section to settings that displays:

- Current household name
- Three action buttons:
    - **Manage Members** - Opens member list modal
    - **Invite Someone** - Opens invitation form modal
    - **My Invitations** - Opens pending invitations modal (with badge showing count)

### 4. Modal Components (`apps/mobile/src/components/settings/`)

#### InviteMemberModal.tsx

- Email input field
- Role selector (viewer/editor/owner)
- Role descriptions for clarity
- Form validation
- Success/error toast notifications

#### HouseholdMembersModal.tsx

- Lists all household members with roles
- Color-coded role badges (danger=owner, warning=editor, medium=viewer)
- Owner-only actions:
    - Change member role (via IonAlert radio buttons)
    - Remove member (with confirmation)
- Cannot remove or modify self
- Current user indicated with "(You)" label

#### HouseholdInvitationsModal.tsx

- Lists pending invitations with household name and inviter
- Shows role you'd be joining as
- Accept button (green checkmark)
- Decline button (red X)
- Refreshes household list after accepting
- Empty state message when no invitations

### 5. Integration with Main App

- **HouseholdProvider** wrapped around authenticated app in `Main.tsx`
- Sits outside LLMModalProvider to ensure availability everywhere
- Integrates with existing auth and database contexts

## User Experience Flow

### Accepting an Invitation

1. User receives invitation from household member
2. Opens app → Settings menu
3. Sees red badge on "My Invitations" button
4. Taps button to view pending invitations
5. Reviews invitation details (household name, inviter, role)
6. Taps green checkmark to accept
7. Becomes member of household instantly
8. Can now access household's stores and shopping lists

### Inviting a New Member

1. User opens Settings menu
2. Taps "Invite Someone"
3. Enters invitee's email address
4. Selects role (viewer/editor/owner)
5. Reviews role descriptions
6. Taps "Send Invitation"
7. Invitation created and ready for invitee to see in their app

### Managing Members (Owner Only)

1. User opens Settings menu
2. Taps "Manage Members"
3. Sees list of all household members with roles
4. Can tap shield icon to change member's role
5. Can tap remove icon to remove member
6. Both actions require confirmation
7. Cannot remove last owner (protected by backend)

## Technical Details

### State Management

- Household state managed via HouseholdProvider context
- Active household ID stored in Capacitor Preferences (persistent)
- Syncs with RemoteDatabase's activeHouseholdId for API calls
- Auto-loads on app start and refreshes on auth changes

### Error Handling

- All API calls wrapped in try/catch
- Toast notifications for success/error states
- Loading states shown during async operations
- Graceful fallbacks for missing data

### Permissions

- Role-based UI (owner-only actions hidden from editors/viewers)
- Backend enforces all permissions (don't trust UI)
- Last owner protection prevents household orphaning

### Data Flow

1. HouseholdProvider loads households on mount
2. Selects active household (first one if none set)
3. RemoteDatabase uses activeHouseholdId for store operations
4. Settings displays current household info
5. Modals fetch fresh data when opened
6. Context refreshes after mutations (accept/invite/remove)

## Testing Checklist

Before testing, ensure:

- [ ] Core package rebuilt: `pnpm --filter @basket-bot/core build`
- [ ] Database reset: `cd apps/backend && pnpm db:init`
- [ ] Backend running: `cd apps/backend && pnpm dev`
- [ ] Mobile running: `cd apps/mobile && pnpm dev`

### Test Scenarios

**Initial Setup:**

- [ ] Register new user
- [ ] User has no households initially
- [ ] Settings shows "No household selected" message

**Creating First Household:**

- [ ] Create household via API (no UI yet)
- [ ] Refresh mobile app
- [ ] Settings shows household name

**Inviting Members:**

- [ ] Open Settings → Invite Someone
- [ ] Enter valid email and select role
- [ ] Submit invitation
- [ ] Success toast appears

**Receiving Invitations:**

- [ ] Log in as invited user
- [ ] Settings shows badge on "My Invitations"
- [ ] Tap to see invitation list
- [ ] See household name and inviter

**Accepting Invitation:**

- [ ] Tap accept (green checkmark)
- [ ] Success toast appears
- [ ] Badge updates/disappears
- [ ] Can now see household stores

**Managing Members (as owner):**

- [ ] Open Settings → Manage Members
- [ ] See list of members with roles
- [ ] Change member role
- [ ] Remove member
- [ ] Confirmations appear

**Edge Cases:**

- [ ] Invite same email twice (should show error)
- [ ] Try to remove last owner (should fail with clear message)
- [ ] Non-owner cannot see role/remove buttons
- [ ] Case-insensitive email matching works

## Known Limitations

1. **No household switcher** - Users with multiple households cannot switch between them yet (only uses first/active)
2. **No create household UI** - Must be done via API or future enhancement
3. **No household editing** - Cannot rename household from mobile
4. **No member search** - Must know email to invite
5. **No invitation history** - Accepted/declined invitations are deleted immediately

## Future Enhancements

### High Priority

- Household switcher (dropdown in settings or header)
- Create household flow
- Edit household name

### Medium Priority

- Household icons/colors
- Member search/autocomplete
- Leave household action (non-owners)
- Transfer ownership flow

### Low Priority

- Invitation links (share via any channel, not just email)
- Invitation expiration dates
- Member activity history
- Custom roles/permissions

## Files Created/Modified

### New Files (11 total)

```
apps/mobile/src/
  households/
    HouseholdContext.tsx
    HouseholdProvider.tsx
    useHousehold.ts
  lib/api/
    household.ts
  components/settings/
    InviteMemberModal.tsx
    HouseholdMembersModal.tsx
    HouseholdInvitationsModal.tsx
```

### Modified Files (3 total)

```
apps/mobile/src/
  components/
    Main.tsx (added HouseholdProvider wrapper)
    settings/Settings.tsx (added household section + modal triggers)
```

## Dependencies

All dependencies were already present in the project:

- @ionic/react (UI components)
- @tanstack/react-query (data fetching)
- @capacitor/preferences (persistent storage)
- @basket-bot/core (shared types)

No new packages were added.

## Notes for Developers

- **Follow the three-file context pattern** for any new contexts
- **Always validate with Zod** at API boundaries
- **Use const arrow functions** for components (`const Comp: React.FC = () => {}`)
- **Prefer Ionic components** over raw HTML (IonButton, IonItem, etc.)
- **Use TanStack Query** for server state (not component state)
- **Show toast notifications** for all user actions (success/error)
- **Handle loading states** with disabled buttons and loading text
- **Keep modals focused** - one responsibility per modal
- **Refresh parent data** after mutations in child modals
