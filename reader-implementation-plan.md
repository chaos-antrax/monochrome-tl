# Reader App Implementation Plan

## Goal

Build a separate public reader application for general users. The reader app should use the same MongoDB database as the translation portal, but it must only expose published novels and published chapter translations.

The reader app should support:

- User signup, login, logout.
- Browsing published novels from the translation portal.
- Adding published novels to a personal library.
- Reading published chapters.
- Light/dark mode.
- Reader customization: 8 background colors, font size, and line spacing.
- Fonts: Lora for reading/prose and Inter for interface text.
- Clean page routing and component structure.
- Minimal UI first. The visual design can be refined later.

Recommended framework: Next.js App Router, deployed as a separate app.

## Repository Assumption

The reader app will be implemented in a completely separate repository from this translation portal.

Do not make the reader app import files from this repository directly. Treat the current translation portal as the content-management backend that writes published content into the shared MongoDB database. The reader app should define its own lightweight types, data-access functions, auth helpers, and UI components.

Recommended separate repo name:

```txt
monochrome-reader
```

Recommended reader repo structure:

```txt
monochrome-reader/
  .env.example
  next.config.ts
  package.json
  src/
    app/
    components/
    lib/
    types/
```

The reader app should copy the current database contract into its own `src/types/content.ts` and `src/lib/published-content.ts`, but only the fields needed for public reading. Do not copy translation-portal UI, workspace state, provider code, export code, job code, or style-guide code.

Long-term option: if both repos become difficult to keep in sync, extract a third shared package later, for example:

```txt
monochrome-contracts/
  src/content.ts
  src/roles.ts
  src/reader.ts
```

Do not start with a shared package unless it is genuinely needed. A separate reader repo with a clearly documented database contract is simpler right now.

## Fresh Repository Setup

Create the reader app outside this repository:

```bash
npx create-next-app@latest monochrome-reader --ts --app --eslint
cd monochrome-reader
npm install mongodb bcryptjs zod lucide-react
```

If using Tailwind, enable it during `create-next-app` or install it afterward. Keep styling minimal and utility-based at first.

Initial files to create in the reader repository:

```txt
src/lib/db.ts
src/lib/session.ts
src/lib/password.ts
src/lib/auth.ts
src/lib/published-content.ts
src/lib/reader-library.ts
src/lib/reader-progress.ts
src/lib/reader-settings.ts
src/types/content.ts
src/types/reader.ts
src/types/user.ts
```

Contract copying rule:

- Copy only the database field names and enum values documented in this plan.
- Do not import from the translation portal repository by relative path, git submodule, or package alias.
- Do not copy client workspace state from the translation portal.
- Do not copy provider/API-key logic.
- Do not copy translation/export/job UI.

The reader repository should connect to the same MongoDB database using its own environment variables.

## Framework Choice

Use Next.js App Router.

Reasons:

- Strong SEO support with server-rendered novel and chapter pages.
- Per-page metadata generation for novels and chapters.
- Sitemap and robots support.
- Mostly server-rendered pages with minimal client-side JavaScript.
- Easy MongoDB access from server components and route handlers.
- Same framework as the translation portal, reducing maintenance cost.

## Fonts

Use:

- `Inter` for UI.
- `Lora` for novel prose and chapter reading.

In `src/app/layout.tsx`:

```ts
import { Inter, Lora } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const lora = Lora({ subsets: ["latin"], variable: "--font-lora" });
```

Apply globally:

```tsx
<html lang="en" className={`${inter.variable} ${lora.variable}`}>
```

CSS:

```css
body {
  font-family: var(--font-inter), system-ui, sans-serif;
}

.reader-prose {
  font-family: var(--font-lora), Georgia, serif;
}
```

## Cross-Repository Contract Policy

Because the reader app lives in a separate repository, the database contract must be treated as an external API.

Rules:

- The reader app owns its own TypeScript types.
- The reader app must not import TypeScript files from this translation portal repository.
- The reader app should define public/read-only DTOs instead of reusing full portal entities.
- The translation portal remains the only app that writes content, translations, glossary terms, publish status, and writer/admin data.
- The reader app only writes reader-specific data such as library entries, progress, and reader settings.
- Any future field rename in this portal must be reflected in the reader repo's local contract types and MongoDB queries.
## Current Database Structure

The reader app will use the same MongoDB database currently used by the translation portal.

Default database name in the current app:

```ts
process.env.MONGODB_DB ?? "monochrome_translations"
```

### `users`

Current translation portal user document:

```ts
type UserDocument = {
  _id?: ObjectId;
  email: string;
  passwordHash: string;
  role?: "reader" | "writer" | "admin";
  provider?: Provider;
  encryptedApiKey?: {
    iv: string;
    authTag: string;
    ciphertext: string;
  };
  selectedModel?: string;
  appState?: unknown;
  createdAt: Date;
  updatedAt: Date;
};
```

Current role rules:

```ts
type UserRole = "reader" | "writer" | "admin";
```

- `reader`: default role. Can use the reader app.
- `writer`: can use the reader app and translation portal.
- `admin`: can use the reader app, translation portal, and user management.

Reader app auth should accept all valid users regardless of role.

Important: the reader app should ignore provider/API key fields entirely.

### `novels`

Current stored shape:

```ts
type StoredNovel = {
  id: string;
  userId: string;
  title: string;
  description: string;
  descriptionTranslated?: string;
  styleGuideId?: string;
  published?: boolean;
  publishedAt?: string;
  createdAt?: Date;
  updatedAt: Date;
};
```

Reader visibility rule:

```ts
published === true
```

Reader app should only fetch novels where `published: true`.

### `chapters`

Current stored shape:

```ts
type StoredChapter = {
  id: string;
  userId: string;
  novelId: string;
  title: string;
  order: number;
  rawText: string;
  rawTextHash: string;
  status: "untranslated" | "queued" | "translating" | "translated" | "failed";
  currentVersion: number;
  published?: boolean;
  publishedVersion?: number;
  publishedAt?: string;
  error?: string;
  updatedAt: Date;
};
```

Reader visibility rule:

```ts
published === true && typeof publishedVersion === "number"
```

Reader app must never show `rawText`.

Reader app must only show the translation version matching `publishedVersion`.

### `translationVersions`

Current stored shape:

```ts
type StoredTranslationVersion = {
  userId: string;
  novelId: string;
  chapterId: string;
  version: number;
  text: string;
  model: ProviderModelName;
  provider: Provider;
  tokensUsed: { input: number; output: number };
  estimatedCost: number;
  createdAt: string;
  rawTextHash: string;
  updatedAt: Date;
};
```

Reader visibility rule:

Join with a published chapter:

```ts
translationVersions.chapterId === chapter.id
translationVersions.version === chapter.publishedVersion
```

Never expose provider/model/token/cost data in the reader app.

### `glossaryTerms`

Current stored shape:

```ts
type StoredGlossaryTerm = {
  id: string;
  userId: string;
  novelId: string;
  sourceTerm: string;
  translation: string;
  category: "character" | "place" | "organization" | "skill" | "item" | "honorific" | "other";
  pinyin?: string;
  notes?: string;
  status: "approved" | "pending" | "rejected";
  discoveredInChapterId?: string;
  conflict?: string;
  updatedAt: Date;
};
```

Reader visibility rule:

```ts
status === "approved"
```

Initial reader app can omit glossary UI unless needed for reading. If included later, expose approved terms only.

### `styleGuides`

Current stored shape:

```ts
type StoredStyleGuide = {
  id: string;
  userId: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  updatedAtDate: Date;
};
```

Reader app should not fetch or expose style guides.

### `jobs`

Current stored shape:

```ts
type StoredJob = {
  id: string;
  userId: string;
  novelId: string;
  chapterId?: string;
  target: "chapter" | "description";
  status: "queued" | "processing" | "completed" | "failed";
  provider: Provider;
  model: string;
  attempts: number;
  tokensUsed?: { input: number; output: number };
  estimatedCost?: number;
  error?: string;
  createdAt: string;
  completedAt?: string;
  updatedAt: Date;
};
```

Reader app should not fetch or expose jobs.

## Reader-Specific Collections

Add these collections to the same database.

### `readerLibrary`

Stores novels added to a user's personal library.

```ts
type ReaderLibraryEntry = {
  _id?: ObjectId;
  userId: string;
  novelId: string;
  addedAt: Date;
  updatedAt: Date;
};
```

Indexes:

```ts
readerLibrary.createIndex({ userId: 1, novelId: 1 }, { unique: true });
readerLibrary.createIndex({ userId: 1, updatedAt: -1 });
```

### `readerProgress`

Tracks last-read chapter and position.

```ts
type ReaderProgress = {
  _id?: ObjectId;
  userId: string;
  novelId: string;
  chapterId: string;
  chapterOrder: number;
  scrollProgress: number; // 0 to 1
  updatedAt: Date;
};
```

Indexes:

```ts
readerProgress.createIndex({ userId: 1, novelId: 1 }, { unique: true });
readerProgress.createIndex({ userId: 1, updatedAt: -1 });
```

### `readerSettings`

Stores global user reading preferences.

```ts
type ReaderSettings = {
  _id?: ObjectId;
  userId: string;
  theme: "light" | "dark" | "system";
  background: ReaderBackground;
  fontSize: number;
  lineHeight: number;
  updatedAt: Date;
};

type ReaderBackground =
  | "paper"
  | "white"
  | "warm"
  | "sepia"
  | "sage"
  | "mist"
  | "charcoal"
  | "black";
```

Defaults:

```ts
const DEFAULT_READER_SETTINGS = {
  theme: "system",
  background: "paper",
  fontSize: 18,
  lineHeight: 1.7,
};
```

Indexes:

```ts
readerSettings.createIndex({ userId: 1 }, { unique: true });
```

Optional later collections:

```txt
readerBookmarks
readerFavorites
readerReviews
readerComments
readerNotifications
```

Do not add these until needed.

## Published Content Query Rules

The reader app must enforce these rules server-side.

### Browse novels

Fetch only published novels.

Projection should be lightweight:

```ts
{
  id: 1,
  userId: 1,
  title: 1,
  descriptionTranslated: 1,
  description: 1,
  publishedAt: 1,
  updatedAt: 1,
}
```

Do not fetch chapters or translation text for the browse page.

### Novel detail page

Fetch:

- Published novel metadata.
- Published chapter summaries only.

Chapter projection:

```ts
{
  id: 1,
  novelId: 1,
  title: 1,
  order: 1,
  published: 1,
  publishedVersion: 1,
  publishedAt: 1,
}
```

Filter:

```ts
{
  novelId,
  published: true,
  publishedVersion: { $type: "number" },
}
```

Sort:

```ts
{ order: 1 }
```

### Chapter reader page

Fetch:

1. Published novel metadata.
2. Published chapter metadata.
3. One translation version matching `chapter.publishedVersion`.
4. Previous/next published chapter summaries.

Do not fetch all translation versions.
Do not fetch raw Chinese text.
Do not fetch unpublished chapters.

## Public Reader Types

Create app-specific public types rather than reusing the translation portal's full internal types.

```ts
export type PublicNovelSummary = {
  id: string;
  title: string;
  description: string;
  publishedAt?: string;
  chapterCount: number;
  inLibrary?: boolean;
};

export type PublicNovelDetail = PublicNovelSummary & {
  chapters: PublicChapterSummary[];
};

export type PublicChapterSummary = {
  id: string;
  title: string;
  order: number;
  publishedAt?: string;
};

export type PublicChapter = PublicChapterSummary & {
  novelId: string;
  novelTitle: string;
  text: string;
  previousChapter?: PublicChapterSummary;
  nextChapter?: PublicChapterSummary;
};
```

## Auth Model

Use the same `users` collection.

Reader app login rules:

- Any existing user can log in if credentials are valid.
- `reader`, `writer`, and `admin` all have reader app access.
- New signups create users with `role: "reader"`.
- Reader app should not allow role editing.
- Reader app should not expose provider/API key fields.

Session strategy:

- Use an HTTP-only signed cookie, similar to the current translation portal.
- Keep sessions independent by using a different cookie name, e.g. `mr_session`.
- Do not reuse the translation portal cookie name `mt_session` unless both apps are on the same trusted domain and intentionally share sessions.

Recommended reader session payload:

```ts
type ReaderSessionPayload = {
  userId: string;
  email: string;
  expiresAt: number;
};
```

## Environment Variables

Reader app `.env.example` in the separate `monochrome-reader` repository:

```env
MONGODB_URI=
MONGODB_DB=monochrome_translations
READER_SESSION_SECRET=
NEXT_PUBLIC_APP_NAME=Monochrome Reader
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

For production, set `NEXT_PUBLIC_SITE_URL` to the public reader domain, for example:

```env
NEXT_PUBLIC_SITE_URL=https://reader.example.com
```

## Routing Plan

Use clear, SEO-friendly routes.

```txt
/                         Landing or redirect to /novels
/login                    Login page
/signup                   Signup page
/logout                   Optional logout route handler
/novels                   Browse all published novels
/novels/[novelId]         Novel detail and chapter list
/novels/[novelId]/read/[chapterId]
                          Reader page
/library                  User's saved novels
/settings                 Reader settings
/account                  Account summary and logout
```

Route protection:

```txt
Public:
  /
  /login
  /signup
  /novels
  /novels/[novelId]
  /novels/[novelId]/read/[chapterId]

Authenticated:
  /library
  /settings
  /account
```

Reading can be public or authenticated. Recommended initial behavior:

- Browse and read are public for SEO.
- Adding to library and saving progress require login.

## API / Route Handler Plan

Prefer server components for public content reads. Use route handlers for mutations.

```txt
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me

GET  /api/library
POST /api/library
DELETE /api/library/[novelId]

GET  /api/settings
PUT  /api/settings

PUT  /api/progress/[novelId]
```

Avoid route handlers for public novel/chapter fetching unless client-side refresh is needed. Server-render the SEO pages directly from MongoDB.

## Component Structure

Recommended file tree:

```txt
src/
  app/
    layout.tsx
    globals.css
    page.tsx
    login/
      page.tsx
      login-form.tsx
    signup/
      page.tsx
      signup-form.tsx
    novels/
      page.tsx
      novel-card.tsx
      [novelId]/
        page.tsx
        chapter-list.tsx
        read/
          [chapterId]/
            page.tsx
            reader-client.tsx
            reader-toolbar.tsx
    library/
      page.tsx
      library-client.tsx
    settings/
      page.tsx
      settings-form.tsx
    account/
      page.tsx
    api/
      auth/
        login/route.ts
        logout/route.ts
        signup/route.ts
        me/route.ts
      library/
        route.ts
        [novelId]/route.ts
      settings/route.ts
      progress/
        [novelId]/route.ts

  components/
    app-shell.tsx
    header.tsx
    nav.tsx
    theme-provider.tsx
    mode-toggle.tsx
    empty-state.tsx
    loading-button.tsx

  components/reader/
    reader-layout.tsx
    reader-prose.tsx
    reader-settings-panel.tsx
    chapter-navigation.tsx
    library-button.tsx

  lib/
    db.ts
    auth.ts
    session.ts
    password.ts
    published-content.ts
    reader-library.ts
    reader-progress.ts
    reader-settings.ts
    validation.ts
    seo.ts
    constants.ts

  types/
    content.ts
    reader.ts
    user.ts
```

Keep UI components minimal and unopinionated. Avoid heavy design abstractions until the visual direction is finalized.

## Reader Settings

Reader settings should be client-controlled but persisted for logged-in users.

Supported settings:

```ts
type ReaderTheme = "light" | "dark" | "system";

type ReaderBackground =
  | "paper"
  | "white"
  | "warm"
  | "sepia"
  | "sage"
  | "mist"
  | "charcoal"
  | "black";

type ReaderSettings = {
  theme: ReaderTheme;
  background: ReaderBackground;
  fontSize: number;
  lineHeight: number;
};
```

Recommended values:

```ts
const BACKGROUNDS = [
  { id: "paper", label: "Paper", light: "#f7f4ed", dark: "#1d1c1a" },
  { id: "white", label: "White", light: "#ffffff", dark: "#111111" },
  { id: "warm", label: "Warm", light: "#fbf1df", dark: "#211b14" },
  { id: "sepia", label: "Sepia", light: "#efe0c8", dark: "#251d15" },
  { id: "sage", label: "Sage", light: "#eef3ea", dark: "#151d16" },
  { id: "mist", label: "Mist", light: "#eef2f5", dark: "#14181c" },
  { id: "charcoal", label: "Charcoal", light: "#e9e9e6", dark: "#202020" },
  { id: "black", label: "Black", light: "#f4f4f4", dark: "#050505" },
] as const;

const FONT_SIZES = [15, 16, 17, 18, 19, 20, 22, 24, 26];
const LINE_HEIGHTS = [1.4, 1.55, 1.7, 1.85, 2.0];
```

Store settings in localStorage immediately for all users. If logged in, debounce-save to MongoDB.

Suggested localStorage key:

```ts
monochrome-reader-settings
```

## SEO Requirements

Novel detail pages should generate metadata:

```ts
export async function generateMetadata({ params }) {
  const novel = await getPublishedNovel(params.novelId);
  return {
    title: `${novel.title} | Monochrome Reader`,
    description: novel.description.slice(0, 160),
    openGraph: {
      title: novel.title,
      description: novel.description.slice(0, 160),
      type: "book",
    },
  };
}
```

Chapter pages should generate metadata:

```ts
{
  title: `${chapter.title} - ${novel.title}`,
  description: `Read ${chapter.title} from ${novel.title}.`,
}
```

Add:

```txt
src/app/sitemap.ts
src/app/robots.ts
```

Sitemap should include:

- `/novels`
- Each published novel page
- Each published chapter page

Only include published content.

## Data Access Functions

Create `src/lib/published-content.ts`.

Required functions:

```ts
getPublishedNovelSummaries(): Promise<PublicNovelSummary[]>
getPublishedNovelDetail(novelId: string, userId?: string): Promise<PublicNovelDetail | null>
getPublishedChapter(novelId: string, chapterId: string): Promise<PublicChapter | null>
getPublishedChapterPaths(): Promise<Array<{ novelId: string; chapterId: string }>>
```

Implementation rules:

- Use projections.
- Never return raw Chinese text.
- Never return unpublished chapters.
- Never return unselected translation versions.
- Never expose writer/admin-only fields.

## Library Functions

Create `src/lib/reader-library.ts`.

Required functions:

```ts
getReaderLibrary(userId: string): Promise<PublicNovelSummary[]>
addNovelToLibrary(userId: string, novelId: string): Promise<void>
removeNovelFromLibrary(userId: string, novelId: string): Promise<void>
isNovelInLibrary(userId: string, novelId: string): Promise<boolean>
```

`addNovelToLibrary` must verify the novel is currently published before adding.

## Progress Functions

Create `src/lib/reader-progress.ts`.

Required functions:

```ts
getProgress(userId: string, novelId: string): Promise<ReaderProgress | null>
saveProgress(input: {
  userId: string;
  novelId: string;
  chapterId: string;
  chapterOrder: number;
  scrollProgress: number;
}): Promise<void>
```

`saveProgress` must verify the chapter is published.

## Settings Functions

Create `src/lib/reader-settings.ts`.

Required functions:

```ts
getReaderSettings(userId: string): Promise<ReaderSettings>
updateReaderSettings(userId: string, settings: ReaderSettings): Promise<ReaderSettings>
```

Validate all settings server-side.

## Initial Implementation Phases

### Phase 1: Scaffold

- Create Next.js app.
- Add Tailwind or plain CSS depending on preference.
- Add Inter and Lora fonts.
- Add MongoDB connection helper.
- Add local reader-repo role/user/content types based on this implementation plan.
- Add basic layout/header.

### Phase 2: Auth

- Implement signup/login/logout.
- Store users in existing `users` collection.
- New signups use `role: "reader"`.
- Any role can log in to reader app.
- Create `/account` page.

### Phase 3: Published Content Browsing

- Implement `/novels`.
- Implement `/novels/[novelId]`.
- Use only published novels and chapters.
- Add metadata generation.

### Phase 4: Reader Page

- Implement `/novels/[novelId]/read/[chapterId]`.
- Fetch only selected published translation version.
- Add previous/next chapter navigation.
- Add minimal reader toolbar.

### Phase 5: Library

- Implement add/remove library buttons.
- Implement `/library`.
- Show saved novels and last-read progress.

### Phase 6: Reader Settings

- Add theme mode: light/dark/system.
- Add 8 background colors.
- Add font size selection.
- Add line height selection.
- Persist locally and remotely for logged-in users.

### Phase 7: SEO

- Add `sitemap.ts`.
- Add `robots.ts`.
- Add canonical URLs.
- Add Open Graph metadata.

### Phase 8: Hardening

- Add server-side validation for every mutation.
- Add rate limiting to auth endpoints if needed.
- Add empty/error states.
- Add loading states.
- Add smoke tests for published-content access rules.

## Security Rules

The reader app must never trust the frontend to filter content.

Server-side rules:

- Public novel pages only query `novels.published === true`.
- Public chapter lists only query `chapters.published === true`.
- Reader page only fetches `translationVersions.version === chapter.publishedVersion`.
- Never return `rawText` to the reader app.
- Never expose `provider`, `model`, `tokensUsed`, `estimatedCost`, `encryptedApiKey`, or `styleGuides`.
- Library/progress mutations require a valid reader session.

## Minimal UI Direction

Keep the initial UI intentionally plain:

- Simple header with logo/name, Library, Browse, Settings, Account.
- Simple cards for novel list.
- Simple chapter list on novel detail page.
- Reader page with centered prose column.
- Minimal settings panel/sheet.
- No decorative heavy design system yet.

Use semantic components with low styling pressure so the final UI can be replaced later.

## Production Notes

- Use a separate repository and deployment from the translation portal.
- Use the same MongoDB database but a different session cookie name.
- Deploy the reader app separately from the translation portal, ideally on its own Vercel project and domain/subdomain.
- Use `NEXT_PUBLIC_SITE_URL` for sitemap/canonical generation.
- Keep reader app database user permissions read/write only for reader-specific collections and read access for published content if using separate MongoDB credentials.
- If traffic grows, add a denormalized `publishedNovels` / `publishedChapters` cache later, but do not start there.
- Keep a manual checklist in the reader repo for database-contract changes from the translation portal. When this portal changes `novels`, `chapters`, or `translationVersions`, update the reader repo types and queries in the same release cycle.





