# Contributions Implementation Plan

## Objective

Add a new admin-side Contributions section to this translation portal. The reader app has already implemented reader-created contribution and translation requests. This admin app must become the approval authority and admin chat interface for those requests.

The essential boundary is:

- Reader app owns request creation and pending-request editing.
- Admin app owns acceptance, rejection, assignment, admin-only request management, and admin chat messages.
- Both apps use the same MongoDB database.
- All admin contribution operations require a current MongoDB user with `role: "admin"`.

## Existing Admin App Context

This app already has the pieces needed to implement this cleanly:

- `src/lib/auth.ts`
  - `requireAdminUser()` already loads the server-side session, reloads the current user from MongoDB, and verifies admin access.
  - Use this for every contributions API route and server page.
- `src/lib/api-errors.ts`
  - Already converts `AuthError` to JSON responses with the correct status.
- `src/lib/repository/indexes.ts`
  - Existing index initialization is centralized through `ensureIndexes()` and `collection()`.
  - Add contribution indexes here unless a separate migration script is introduced first.
- `src/app/app/shell.tsx`
  - Existing admin-only navigation is already conditionally rendered based on `account.role === "admin"`.
  - Add a `Contributions` nav item for admins only.
- `src/app/app/admin/users/*`
  - Use this as the implementation style reference for an admin-only page plus `/api/admin/*` route handlers.

## Shared Data Contract

Create a local contract file in this app, for example:

```txt
src/lib/contributions/types.ts
```

Use these exact collection names:

```txt
readerContributionRequests
readerContributionMessages
readerContributionAudit
users
```

Add the following types:

```ts
export type ContributionRequestType = "translation" | "contribution";
export type ContributionRequestStatus = "pending" | "accepted" | "rejected";

export type ContributionRequest = {
  id: string;
  userId: string;
  type: ContributionRequestType;
  novelTitle: string;
  description: string;
  status: ContributionRequestStatus;
  adminId?: string;
  createdAt: Date;
  updatedAt: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
};

export type ContributionMessage = {
  id: string;
  requestId: string;
  senderId: string;
  senderRole: "reader" | "admin";
  body: string;
  createdAt: Date;
};

export type ContributionAuditEvent = {
  id: string;
  requestId: string;
  actorId: string;
  action: "accepted" | "rejected" | "reassigned" | "admin_message_sent";
  metadata?: Record<string, unknown>;
  createdAt: Date;
};
```

Important rules:

- Do not let admin route handlers accept `status`, `adminId`, `acceptedAt`, or `rejectedAt` from the client directly.
- These fields are changed only by guarded server mutations.
- Do not expose password hashes, API keys, provider config, appState, or auth metadata in contribution responses.

## Environment

Use the same MongoDB database as the reader app and this admin app:

```env
MONGODB_URI=mongodb://...
MONGODB_DB=monochrome_translations
```

Rules:

- Do not use `NEXT_PUBLIC_` for MongoDB values.
- Access MongoDB only in server modules, route handlers, or server actions.
- Do not fetch contribution collections from client components directly.

## Repository Layer

Create contribution repository modules instead of putting MongoDB logic directly in route handlers.

Recommended files:

```txt
src/lib/contributions/types.ts
src/lib/contributions/repository.ts
src/lib/contributions/mappers.ts
```

`repository.ts` should export:

```ts
export async function contributionRequestsCollection()
export async function contributionMessagesCollection()
export async function contributionAuditCollection()
export async function listAdminContributionRequests(input)
export async function getAdminContributionRequest(requestId: string)
export async function acceptContributionRequest(requestId: string, adminId: string)
export async function rejectContributionRequest(requestId: string, adminId: string)
export async function listContributionMessages(requestId: string, adminId: string)
export async function sendContributionAdminMessage(input)
export async function createContributionAuditEvent(input)
```

`mappers.ts` should convert MongoDB dates to ISO strings for API responses and strip sensitive user data.

## Indexes

Add indexes to `src/lib/repository/indexes.ts` inside `createIndexes()`.

Add:

```ts
db.collection("readerContributionRequests").createIndex(
  { id: 1 },
  { unique: true, name: "reader_contribution_request_id" },
),

db.collection("readerContributionRequests").createIndex(
  { userId: 1, createdAt: -1 },
  { name: "reader_contribution_requests_user" },
),

db.collection("readerContributionRequests").createIndex(
  { status: 1, createdAt: 1 },
  { name: "reader_contribution_requests_admin_inbox" },
),

db.collection("readerContributionRequests").createIndex(
  { adminId: 1, status: 1, updatedAt: -1 },
  { name: "reader_contribution_requests_assignee" },
),

db.collection("readerContributionMessages").createIndex(
  { requestId: 1, createdAt: 1 },
  { name: "reader_contribution_messages_thread" },
),

db.collection("readerContributionAudit").createIndex(
  { requestId: 1, createdAt: 1 },
  { name: "reader_contribution_audit_request" },
),
```

For the first implementation, use the app's existing index setup pattern. Move to a dedicated migration later only if startup index checks become a measurable issue.

## Authorization Rules

Every contribution endpoint must call `requireAdminUser()`.

Rules:

- Return 401 if unauthenticated.
- Return 403 if authenticated but not admin.
- Never trust a role from the client.
- Never trust a role stored only in the session cookie.
- Always reload the current user from MongoDB, which `requireAdminUser()` already does.

For chat endpoints, also require:

```ts
request.status === "accepted"
request.adminId === currentAdmin.id
```

Only the assigned admin can read or write admin-side chat messages.

## API Routes

Create this route tree:

```txt
src/app/api/admin/contributions/route.ts
src/app/api/admin/contributions/[requestId]/route.ts
src/app/api/admin/contributions/[requestId]/messages/route.ts
```

### List Requests

`GET /api/admin/contributions`

Supported query parameters:

```txt
status=pending|accepted|rejected
type=translation|contribution
assignee=me|all
search=novel title or reader identity
sort=oldest|newest|updated
cursor=...
limit=...
```

Defaults:

```ts
status = "pending";
sort = "oldest";
limit = 25;
assignee = "all";
```

Pending requests should default to oldest-first.

Response shape:

```ts
type AdminContributionListResponse = {
  items: Array<{
    id: string;
    type: "translation" | "contribution";
    novelTitle: string;
    description: string;
    status: "pending" | "accepted" | "rejected";
    adminId?: string;
    createdAt: string;
    updatedAt: string;
    acceptedAt?: string;
    rejectedAt?: string;
    user: { id: string; username?: string; email: string };
    admin?: { id: string; username?: string; email: string };
  }>;
  nextCursor?: string;
};
```

Implementation notes:

- Join `users` by `userId`.
- Join `users` by `adminId` when present.
- Project only `email`, optional `username`, and `_id`/id.

### Retrieve One Request

`GET /api/admin/contributions/[requestId]`

Return full request details, reader identity, assigned admin identity, timestamps, and `canOpenChat`.

`canOpenChat` is true only when:

```ts
request.status === "accepted" && request.adminId === currentAdmin.id
```

Return 404 if the request does not exist.

### Accept Request

`PATCH /api/admin/contributions/[requestId]`

Body:

```json
{ "action": "accept" }
```

Use an atomic guarded update:

```ts
const result = await requests.findOneAndUpdate(
  { id: requestId, status: "pending" },
  {
    $set: {
      status: "accepted",
      adminId: currentAdmin.id,
      acceptedAt: new Date(),
      updatedAt: new Date(),
    },
    $unset: { rejectedAt: "" },
  },
  { returnDocument: "after" },
);
```

After success, write an audit event: `accepted`.

If no document is returned:

- Reload by `id`.
- Return 404 if missing.
- Return 409 if already accepted/rejected.

### Reject Request

`PATCH /api/admin/contributions/[requestId]`

Body:

```json
{ "action": "reject" }
```

Use an atomic guarded update:

```ts
const result = await requests.findOneAndUpdate(
  { id: requestId, status: "pending" },
  {
    $set: {
      status: "rejected",
      adminId: currentAdmin.id,
      rejectedAt: new Date(),
      updatedAt: new Date(),
    },
    $unset: { acceptedAt: "" },
  },
  { returnDocument: "after" },
);
```

After success, write an audit event: `rejected`.

Rejected requests do not open chat.

Do not add rejection reason in the first implementation unless the reader app also supports displaying it.

## Chat API

### Load Messages

`GET /api/admin/contributions/[requestId]/messages`

Before returning messages:

- Require admin.
- Load request.
- Require `request.status === "accepted"`.
- Require `request.adminId === currentAdmin.id`.

Query:

```ts
messages.find({ requestId }).sort({ createdAt: 1 });
```

Return ISO-formatted timestamps.

### Send Message

`POST /api/admin/contributions/[requestId]/messages`

Body:

```json
{ "body": "Message to the reader" }
```

Validation:

```ts
const schema = z.object({
  body: z.string().trim().min(1).max(2000),
});
```

Before insertion:

- Require admin.
- Reload request.
- Require accepted status.
- Require assigned admin.

Insert:

```ts
await messages.insertOne({
  id: crypto.randomUUID(),
  requestId,
  senderId: currentAdmin.id,
  senderRole: "admin",
  body: parsed.body,
  createdAt: new Date(),
});
```

After insertion, write an audit event: `admin_message_sent`. Do not copy the message body into audit metadata.

## State Transitions

Only allow:

```txt
pending -> accepted
pending -> rejected
```

Do not allow:

```txt
accepted -> pending
rejected -> pending
accepted -> rejected
rejected -> accepted
```

If reopening is ever required, implement it as a separate privileged endpoint with audit logging.

## Assignment Rules

Initial implementation uses automatic assignment:

- The admin who accepts a request becomes the assigned admin.
- Only that admin can read or send chat messages for the request.
- Other admins can see the request is assigned, but cannot enter the chat.

Do not implement reassignment in the first release.

## Admin UI Routes

Add routes:

```txt
src/app/app/contributions/page.tsx
src/app/app/contributions/[requestId]/page.tsx
src/app/app/contributions/[requestId]/chat/page.tsx
```

Recommended URL path: `/app/contributions`.

Add an admin-only nav item in `src/app/app/shell.tsx`:

```txt
Contributions
```

Use a lucide icon such as `Inbox`, `MessagesSquare`, or `Handshake`.

## Admin Inbox UI

The main Contributions page should contain tabs:

```txt
Pending
Active chats
Rejected
All
```

Tab behavior:

- Pending: `status=pending&sort=oldest`.
- Active chats: `status=accepted&assignee=me&sort=updated`.
- Rejected: `status=rejected&sort=newest`.
- All: no status filter, `sort=updated`.

Recommended card fields:

- Request type badge.
- Novel title.
- Description preview.
- Reader email or username.
- Submitted timestamp.
- Edited timestamp when `updatedAt !== createdAt`.
- Current status.
- Assigned admin when applicable.
- Accept button for pending requests.
- Reject button for pending requests.
- Open chat button for accepted requests assigned to current admin.

Because readers can edit pending requests, refresh the request detail before accepting or rejecting.

## Request Detail UI

Opening a pending request should show:

- Request type.
- Full novel title.
- Full description.
- Reader identity.
- Submitted time.
- Last edited time.
- Current status.
- Assigned admin when present.
- Accept action.
- Reject action.

Use confirmation dialogs.

Reject confirmation:

```txt
Reject this request?

The reader will no longer be able to edit it, and no chat will be opened.
```

Accept confirmation:

```txt
Accept and open chat?

You will be assigned to this request and can begin messaging the reader.
```

Disable action controls while mutations are running.

## Active Chat UI

The accepted chat view should include:

- Novel title.
- Request type.
- Original request description.
- Reader identity.
- Assigned administrator.
- Chronological message thread.
- Message composer.
- Loading skeleton.
- Empty-chat state.
- Mutation error feedback.
- New messages indicator when appropriate.

Message layout:

- Admin messages on the right.
- Reader messages on the left.
- Clearly label sender.
- Show timestamps.

Polling behavior for the first release:

- Poll every 10 seconds while the chat page is visible.
- Pause polling when `document.visibilityState === "hidden"`.
- Refresh immediately after sending a message.
- Do not show a full skeleton during background refreshes.
- Stop polling on component unmount.

## Error Handling

Use consistent API errors:

```ts
type ApiError = {
  error: string;
  code?: string;
};
```

Status codes:

```txt
400 malformed request
401 session missing or expired
403 not admin, or not assigned to chat
404 request not found
409 request already processed by another admin
422 invalid action or invalid state transition
500 unexpected server failure
```

UI behavior:

- Show mutation errors as toast notifications.
- Keep current page state after mutation failure.
- For 401, redirect to `/login` while preserving intended destination if practical.
- For 403 on chat, show an access-denied empty state instead of a broken thread.

## Pending Request Slot Awareness

The reader app enforces a maximum of three pending requests per reader.

Admin app implications:

- Accepting a request frees a pending slot.
- Rejecting a request frees a pending slot.
- Accepted and rejected requests do not count.
- Editing a pending request does not change the count.
- Admin app should never create reader requests.

No admin implementation is needed for slot counting beyond correct status transitions.

## Audit Logging

Create audit collection in the first implementation if time allows. Prefer adding it now because accept/reject actions are important decisions.

Collection:

```txt
readerContributionAudit
```

Log at minimum:

- `accepted`
- `rejected`
- `admin_message_sent`

Future:

- `reassigned`

Do not copy message bodies into audit metadata.

## Notification Strategy

First release:

- Reader app can rely on its account/contributions page polling or refreshing request status.
- Admin app does not need email or push notifications.

Future additions:

- Notify reader when a request is accepted.
- Notify reader when a request is rejected.
- Notify reader when an admin sends a message.
- Notify assigned admin when reader sends a message.
- Add unread message counts in both apps.

## Realtime Upgrade Option

Polling is sufficient initially.

Future realtime events:

```txt
contribution.request.created
contribution.request.updated
contribution.request.accepted
contribution.request.rejected
contribution.message.created
```

Authorize every subscription by user role and request assignment.

## Testing Checklist

Authorization:

- Reader accounts cannot access admin contribution endpoints.
- Writer accounts cannot access admin contribution endpoints.
- Unauthenticated users receive 401.
- Admin users can list requests.
- An admin cannot access another admin's assigned chat.
- The assigned admin can load and send messages.

Request lifecycle:

- A pending request can be accepted.
- A pending request can be rejected.
- Two admins cannot accept the same request.
- Two admins cannot reject the same request.
- Accepted requests cannot be rejected afterward.
- Rejected requests cannot be accepted afterward.
- Chat remains unavailable until acceptance.

Reader editing visibility:

- Edits to a pending request appear in the admin inbox.
- `updatedAt` changes after reader edit.
- Accepted requests can no longer be edited by the reader app.
- Rejected requests can no longer be edited by the reader app.
- Admin decisions use the latest request state.

Chat:

- Reader and admin messages appear in chronological order.
- Empty messages are rejected.
- Messages longer than 2,000 characters are rejected.
- Messages cannot be inserted for pending or rejected requests.
- Reader messages use `senderRole: "reader"`.
- Admin messages use `senderRole: "admin"`.

Pending limit:

- A reader with three pending requests cannot submit a fourth in the reader app.
- Acceptance frees a request slot.
- Rejection frees a request slot.
- Editing does not affect the count.

UI:

- Pending tab defaults oldest-first.
- Active chat tab shows only current admin assignments by default.
- Rejected tab shows newest-first.
- Search matches novel title and reader identity.
- Mutating buttons disable while requests are in flight.
- Conflict responses produce clear toast feedback.

## Recommended Implementation Order

1. Add contribution types and repository helpers.
2. Add indexes in `src/lib/repository/indexes.ts`.
3. Add list/detail/accept/reject API routes.
4. Add message list/send API routes.
5. Add audit event writes for accept/reject/message.
6. Add admin nav entry.
7. Build contributions inbox page with Pending, Active chats, Rejected, All tabs.
8. Build request detail page with accept/reject confirmations.
9. Build assigned chat page with polling.
10. Add search, filters, cursor pagination, and loading states.
11. Run authorization and lifecycle tests manually against seeded requests.
12. Run `npm run lint` and `npm run build`.

## Manual Seed Data For Testing

Insert a pending request manually if the reader app has no data yet:

```js
db.readerContributionRequests.insertOne({
  id: crypto.randomUUID(),
  userId: "READER_USER_OBJECT_ID_AS_STRING",
  type: "translation",
  novelTitle: "Example Novel",
  description: "Please translate this novel.",
  status: "pending",
  createdAt: new Date(),
  updatedAt: new Date(),
});
```

Ensure `userId` points to an existing `users._id` string.

## Non-Goals For First Release

Do not implement these yet:

- Reader request creation in admin app.
- Reassignment UI.
- Super-admin role.
- Email notifications.
- Push notifications.
- WebSocket/SSE realtime.
- Reopening accepted/rejected requests.
- Rejection reasons unless the reader app also supports them.

## Final Rule

The reader creates and edits pending requests. The admin app exclusively controls approval, rejection, assignment, and the admin side of accepted chats.
