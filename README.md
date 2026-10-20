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

Use a supported Node.js runtime (Node 24 LTS recommended) and `npm ci`.

- `npm test`: run the complete Vitest suite once with V8 coverage.
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

The migrated baseline is 41 tests in 11 files. Full-source coverage is 48.37%
statements, 37.86% branches, 60% functions and 48.79% lines. Thresholds start at
48/37/60/48 respectively to prevent regressions. The old Jest 80% thresholds did
not explicitly include unimported production modules; they are not comparable
to this full-source baseline. Raise these thresholds as coverage grows.

Next tests should target ingestion orchestration and failure ordering; route
validation, CORS and streaming lifecycle; safe URL fetching/redirects; database
HTTP failures; and Redis concurrency/cache failures. Production behaviour was
preserved during migration, including `chunkText('')` returning `['']`.

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
