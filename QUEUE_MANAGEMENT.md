# Queue Management Implementation

## Problem

When a request fails permanently (not due to network issues), the queued mutations would stay in the queue forever, causing the unsynced changes icon to never go away. There was no way for users to review or clear these stuck mutations.

## Solution

Implemented a complete queue management UI that allows users to:

1. **Review queued mutations** - See all pending changes with details
2. **Clear individual items** - Remove specific problematic mutations
3. **Clear entire queue** - Start fresh if needed

## Implementation Details

### 1. Backend Changes (mutationQueue.ts)

- Added `removeMutation(mutationId)` method to allow manual removal of individual items
- Made `getQueue()` method more explicit about returning detailed mutation info
- Already had `clearQueue()` for clearing all mutations

### 2. New Components

#### QueueReviewModal

- Modal that displays all queued mutations
- Shows for each mutation:
    - Operation name (e.g., "POST: Toggle Item")
    - Timestamp
    - Retry count (if > 0)
    - Last error message (if failed)
- Actions:
    - **Clear All** button - removes all pending changes
    - **Remove** button per item - removes individual mutations

#### QueueReviewModal.scss

- Clean, readable styling
- Color-coded retry counts (warning) and errors (danger)
- Proper spacing and layout

### 3. Enhanced Hooks

#### useQueueActions (new hook in useRefreshAndSync.ts)

Provides queue management actions:

- `clearQueue()` - Clear all pending mutations
- `removeMutation(id)` - Remove specific mutation
- `getQueue()` - Get all queued mutations
- Includes toast notifications for success/error feedback

### 4. Enhanced NetworkStatusBanner

- Now **clickable** when there are pending changes
- Shows "Tap to review" hint when queue has items
- Opens QueueReviewModal on click
- Visual feedback (hover/active states)

## User Flow

1. **Viewing pending changes**: User sees banner "3 changes pending • Tap to review"
2. **Opening queue review**: User taps banner → modal opens
3. **Reviewing mutations**: User sees list of all pending changes with details
4. **Removing single item**: User taps trash icon on a mutation → item removed, toast shown
5. **Clearing all**: User taps "Clear All" → all mutations cleared, modal closes, toast shown

## Edge Cases Handled

- Empty queue state with friendly message
- Queue updates in real-time (modal refreshes on open)
- Error handling for all operations
- Toast notifications for all actions
- Proper cleanup on modal close

## Testing Checklist

- [ ] Banner appears when there are pending mutations
- [ ] Banner is clickable and opens modal
- [ ] Modal displays all queued mutations correctly
- [ ] Individual remove button works and updates the list
- [ ] Clear All button works and closes modal
- [ ] Toast notifications appear for all actions
- [ ] Modal updates when mutations are removed
- [ ] Banner disappears when queue is empty

## Files Modified

1. `apps/mobile/src/lib/mutationQueue.ts` - Added removeMutation method
2. `apps/mobile/src/hooks/useRefreshAndSync.ts` - Added useQueueActions hook
3. `apps/mobile/src/components/shared/NetworkStatusBanner.tsx` - Made clickable, added modal
4. `apps/mobile/src/components/shared/NetworkStatusBanner.scss` - Added clickable styling

## Files Created

1. `apps/mobile/src/components/shared/QueueReviewModal.tsx` - Main modal component
2. `apps/mobile/src/components/shared/QueueReviewModal.scss` - Modal styling

## Documentation Updated

- Removed "The offline mode thing doesn't go away..." item from `todo.md` (issue resolved)
