This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Backend tests

### Pinecone vector ID transition

Ingestion IDs now use `sha256(url)-userType-contentHash-chunk-index`. The URL hash
keeps IDs bounded; the original URL and audience remain in metadata for querying
and deletion. The external ingestion API is unchanged.

Existing vectors remain readable, but changing the ID format does not restore
vectors previously overwritten by another audience. Unchanged content is still
skipped using the database content hash, so simply ingesting again will not
migrate those records.

For this prototype, the simplest clean rebuild is to pause ingestion, back up the
URL/audience database records, clear only this application's vectors in its
Pinecone index/namespace, and remove the corresponding ingestion database records.
Then re-ingest every saved URL/audience pair and verify retrieval for all three
audiences before resuming ingestion. Do not clear a shared index or unrelated data.
This is an operator procedure; deployment does not automatically delete records.

For a selective rebuild, delete vectors with **both** `url` and `userType` metadata
filters, remove the matching database record, then re-ingest that pair. Repeat for
every affected audience. Metadata deletion matches legacy and new IDs, avoiding
duplicates. Previously overwritten audiences must also be rebuilt.

Replacement still deletes existing vectors before embedding/upserting. A failed
upsert propagates without updating the database, but can leave the replaced
audience without vectors (or with a partial upsert). Replacement ordering and
cross-store consistency are deferred; this change does not add rollback.

Use a supported Node.js runtime (Node 24 LTS recommended) and `npm ci`.

- `npm run test:coverage`: run the complete Vitest suite once with V8 coverage.
- `npm run test:run`: run the suite once without coverage.
- `npm test`: start Vitest in its default interactive mode.
- `npm run test:watch`: watch tests during development.
- `npm run typecheck`: check production and test TypeScript.
- `npm run lint -- src/ vitest.config.mts`: lint application, tests and test configuration.

Tests live under `src/tests/`, mirroring production paths. An `index.ts` module
has an `index.test.ts`; retrieval also has an `index.empty.test.ts` failure suite.
The suite uses the Node environment, not jsdom or React Testing Library.

`src/tests/setup.ts` supplies dummy configuration, suppresses dotenv loading,
mocks Mongoose, and blocks unexpected fetch/socket connections during imports
and test execution. Individual tests mock Axios, OpenAI, Pinecone and Redis at
module boundaries. No running services, production credentials or `.env` file
are required. Keep external calls mocked when adding tests.

Coverage includes every TypeScript module under `src/lib/` and `src/app/api/`,
including modules never imported by tests. Types/declarations, generated output,
scripts, tests and the starter UI are excluded. JavaScript constants and unused
JavaScript Mongoose models are outside this TypeScript coverage scope.
Reports are generated in `coverage/`: `index.html`, `lcov.info` and
`coverage-summary.json`.

The current suite has 226 tests in 19 files. Full-source coverage is 98.46%
statements, 96.24% branches, 97.18% functions and 99.13% lines. The review baseline
was 148 tests with 93.35% statements, 83.90% branches, 89.39% functions and 93.77%
lines. All three API routes have 100% line and function coverage. Global minimums
are 95% statements, 90% branches, 95% functions and 95% lines; API routes also
require 95% statements, 85% branches and 100% functions/lines.

Route tests cover authentication, invalid input, rate limiting, streaming failures,
incomplete OpenAI responses, cooperative stream cancellation and best-effort
message persistence. DB helpers check HTTP status and encode history IDs.
Ingestion tests characterize current failure ordering: replacements still delete
old vectors before embedding/upload, partial uploads can remain searchable, and
failed DB writes do not roll back Pinecone. There is no activation mechanism,
post-activation cleanup, rollback or concurrency protection to test yet.

Reset individual dependency mocks rather than using `vi.resetAllMocks()` inside
tests: a broad reset can restore the real socket implementation underneath the
network guard. Only the isolated loopback transport fixture restores it explicitly.

GitHub Actions runs on pushes and pull requests with Node 24, `npm ci`, coverage,
TypeScript, ESLint and a production build. It uploads coverage reports, uses a
read-only repository token and supplies placeholder service configuration. Redis
connects lazily, so importing routes during a build does not need a Redis server.
The starter backend page still downloads Google Fonts at build time; it needs
network access to Google Fonts, but no OpenAI/Pinecone/Redis/MongoDB/DB API service
or production credentials are needed to build.

Remaining integration risks include real browser disconnects, OpenAI transport
abort timing, Pinecone eventual consistency, concurrent ingestion/rate limiting,
and external DB guarantees. Unit tests mock these services. Request aborts and
response cancellation forward an abort signal to the OpenAI SDK before requesting
iterator closure; retrieval and DB operations do not currently accept that signal.

### Query stream completion and history

The query endpoint preserves its plain-text streaming format. Only normally
completed, uncancelled assistant answers are saved to history. Failed, incomplete
and cancelled answers are omitted; the original user message can remain. Message
persistence is best effort: a failed write does not fail a completed answer, and
unexpected persistence/iterator-cleanup rejections are caught.

The frontend must consume the response body through a clean EOF before treating an
answer as complete, and handle rejected `reader.read()` or `response.text()` calls
as failures, even after displaying partial text. HTTP 200 and `X-AI-Status: answered`
are sent before generation completes; the header describes context availability,
not final success. Explicit OpenAI failure/incomplete events and missing completion
events error the response body. Headers cannot change after streaming starts.
No frontend code or response format changed. An explicit terminal success/error
event would require a protocol/frontend change (for example SSE) to also detect
intermediaries that mask a failed body as a clean EOF.

## URL ingestion security

`src/lib/ingest/safeFetch/` is the URL-fetching boundary used by the scraper.
It permits HTTP(S) without credentials, requires all DNS answers to be public,
and pins a fresh direct Node HTTP(S) connection to the first validated address.
The original hostname is retained for Host, TLS SNI and certificate validation.
No environment proxy, automatic redirects, retries or pooled sockets are used.
IPv4 special-use ranges and Azure's platform virtual IP are blocked. IPv6 is
restricted to global unicast with special-purpose/documentation/tunnel ranges
excluded; mapped and translated IPv4 forms are rejected conservatively.

Limits: 5 seconds to connect/TLS handshake, 5 seconds idle socket time, 15 seconds
overall including DNS, and 2 MiB actual response bytes. Responses must be successful
HTML or XHTML. Compressed responses are rejected (identity encoding is requested).
Errors use the existing ClientError response shape without internal network details.

Redirecting URLs must now be replaced with their final public URL. Sites requiring
compression, non-UTF-8 decoding or more than 2 MiB are not supported by this boundary.
There is no automatic fallback to another validated DNS address. HTTP remains
unencrypted, and public network routing/egress controls remain deployment concerns.
DNS cannot be cancelled by Node's lookup API, but late resolution cannot start a
request after the deadline.

The transport test opens only a loopback server, with a test-only address-policy
exception for that fixture. Production-policy tests separately reject loopback.
It verifies that the real Node HTTP/socket stack uses the validated snapshot and
preserves Host; tests do not contact public websites. Restricted sandboxes may
need permission to bind the loopback listening socket.

## Shared-key access for this prototype

Set `INGEST_API_KEY` to a long random secret in the backend's server environment.
`POST /api/ingest` and `GET /api/query/[userId]` require the same value in the
`x-api-key` header. Missing/incorrect headers return HTTP 401 with
`{ "success": false, "error": "Unauthorized" }`. Missing/blank server configuration
fails closed with HTTP 503 and a generic error. Checks happen before request
parsing, scraping or database access. History responses are not cacheable.
`POST /api/query` stays public with its existing rate limiting; public OPTIONS
preflights remain available. The static GET /api/ingest response is unchanged.

Never use `NEXT_PUBLIC_INGEST_API_KEY`, put the key in a URL, expose it through
client props, or log request headers. The guard is marked `server-only`; it reads
the key at request time and returns no credential details. No new dependencies
or account/session infrastructure are required. Use HTTPS outside local development.

### Separate Next.js frontend

Browser code currently calling ingestion or history directly must stop doing so:
it cannot safely hold this key. Move those calls into frontend server-only code
(a Route Handler, Server Action or protected server-rendered administrative flow),
configure the same secret in that frontend's server environment, and attach
`x-api-key` only on the server-to-server request. Keep backend base URLs in server
configuration for these calls, and disable caching of history requests/responses.
Do not forward the key to the browser, an upstream error page or response headers.
Public question requests can continue calling POST /api/query without a key.

A publicly callable frontend proxy that automatically adds the key would recreate
public access to ingestion/history. For this portfolio prototype, keep these
operations in a private administrative/server-side workflow (or disable the public
history UI) unless the frontend already restricts access to that workflow. A
Server Action is also publicly reachable and is not access control by itself.
A shared key grants access to all history IDs; this is not per-user ownership.
No frontend repository changes were made here.
