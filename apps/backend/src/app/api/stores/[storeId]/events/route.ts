import { withAuth } from "@/lib/auth/withAuth";
import { createStoreEventsHandler } from "@/lib/realtime/storeEventStream";

/**
 * GET /api/stores/[storeId]/events
 * Server-Sent Events: "this store changed" notifications for the live shopping list.
 * Events carry no item data; the client refetches through the normal GET endpoints.
 * Wire format and lifecycle: `lib/realtime/storeEventStream.ts`.
 */
export const dynamic = "force-dynamic";

export const GET = withAuth(createStoreEventsHandler());
