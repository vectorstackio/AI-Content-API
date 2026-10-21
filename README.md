AI Cotent API
A Next.js and TypeScript backend for an AI-powered research and question-answering application. It ingests web content, creates embeddings, indexes content in Pinecone, and answers questions using retrieval-augmented generation (RAG) with streamed OpenAI responses.
Built as part of the ReasonStack software engineering portfolio, with an emphasis on practical AI integrations, backend reliability, security, and automated testing.
Status: Portfolio prototype. The query endpoint is public and rate-limited. Ingestion and conversation-history endpoints require a shared server-side API key. Ingestion replacement is not yet atomic; see Known limitations.

Architecture
Web page URL
    │
    ▼
POST /api/ingest ──► Safe HTML fetch ──► Chunking ──► OpenAI embeddings
    │                                                    │
    └──► External database API ◄──────────────────────────┴──► Pinecone

User question
    │
    ▼
POST /api/query ──► Redis rate limit ──► Pinecone retrieval
    │                                          │
    └──► OpenAI streamed answer ◄──────────────┘
              │
              └──► External database API (conversation persistence)
The application uses an external database API for persistence. A MongoDB connection is also present in the codebase. The frontend is a separate Next.js application.
Technology
- Runtime: Node.js 24, Next.js App Router, TypeScript
- AI: OpenAI embeddings and streamed responses
- Vector search: Pinecone
- Rate limiting: Redis / ioredis
- Content ingestion: HTML scraping, chunking, embedding and indexing
- Validation: Zod
- Testing: Vitest with V8 coverage
- CI: GitHub Actions (tests, coverage, type checking, linting and build)
API endpoints
Method	Endpoint	Purpose	Access
POST	/api/ingest	Ingest a web URL for an audience	Shared API key
POST	/api/query	Retrieve context and stream an AI answer	Public, rate-limited
GET	/api/query/[userId]	Retrieve conversation history	Shared API key


Protected requests require x-api-key: <INGEST_API_KEY>. The key must be supplied from a trusted server, never from browser code. The public query endpoint remains subject to rate limiting.
Audience-specific indexing
Ingestion supports the audiences pupil, teacher, and tutor. Vector IDs use a deterministic format based on the URL hash, audience, content hash, and chunk index:
sha256(url)-userType-contentHash-chunk-index
The original URL and audience remain in Pinecone metadata for retrieval and deletion. Audience-specific IDs prevent one audience's ingestion from overwriting another audience's vectors.
Local development
Prerequisites: Node.js 24, npm, and access to the configured OpenAI, Pinecone, Redis, and external database services for runtime operations.
npm ci
npm run dev
Configure the environment variables required by src/lib/common/config/index.ts before starting the application. The main service settings include:
Variable	Purpose
OPENAI_API_KEY	OpenAI API access
PINECONE_API_KEY	Pinecone API access
PINECONE_INDEX_NAME	Target Pinecone index
INGEST_API_KEY	Shared secret for protected API endpoints
DB_URL	Database connection configuration
API_URL	External API base URL
API_AUTH_TOKEN	External API authentication


Check the configuration module for the authoritative list and any additional required settings. Do not commit real credentials or expose server secrets using NEXT_PUBLIC_ variables.
The Redis client is currently configured for 127.0.0.1:6379 and connects lazily. Adjust the configuration for your deployment as needed.
Testing and CI
npm run test:run       # Run Vitest once
npm run test:coverage  # Run tests with V8 coverage
npm run test:watch     # Watch mode
npm run typecheck      # TypeScript validation
npm run lint           # ESLint
npm run build          # Production build
Tests live under src/tests/, mirroring the production source tree. Tests use the Node environment and mock external dependencies, including OpenAI, Pinecone, Redis, MongoDB, Axios and HTTP calls. No live service credentials are needed for the unit suite.
Latest documented test results: 226 tests across 19 files.
Metric	Coverage
Statements	98.46%
Branches	96.24%
Functions	97.18%
Lines	99.13%


All three API routes have 100% line and function coverage. Coverage thresholds are enforced in Vitest. GitHub Actions runs on pushes and pull requests using Node.js 24 and includes coverage artifacts, TypeScript, ESLint, and a production build with non-production placeholder configuration.
The default Next.js starter page may require Google Fonts network access during a build. A Webpack build has also been used successfully in restricted environments:
npm run build -- --webpack
Security
- SSRF protection: URL ingestion accepts HTTP(S) URLs without credentials, validates public DNS addresses, and pins the connection to the validated address. Private and special-use addresses are blocked.
- Fetch limits: 5-second connection/TLS timeout, 5-second idle timeout, 15-second overall deadline, and a 2 MiB response limit.
- Content restrictions: Only successful HTML/XHTML responses are accepted. Redirects and compressed responses are not followed/accepted by the safe-fetch boundary.
- Protected endpoints: Ingestion and history require INGEST_API_KEY via x-api-key. Missing or incorrect keys return 401; missing server configuration fails closed.
- Public query: Rate-limited with Redis.
- Streaming: Request aborts and response cancellation are forwarded to the OpenAI stream where supported. Failed, incomplete, and cancelled assistant answers are not saved as completed history.
A shared API key authenticates a calling server, not an individual visitor. Do not expose an unrestricted frontend proxy that attaches this key for arbitrary users or history IDs.
Data migration and re-ingestion
Changing the Pinecone vector ID format does not rename existing vectors. Legacy vectors can remain searchable, but vectors overwritten by earlier cross-audience ID collisions cannot be recovered automatically.
Because unchanged content may be skipped using the database content hash, simply re-ingesting a URL may not migrate its existing vectors.
For this prototype, a controlled rebuild may be simplest: pause ingestion; back up URL/audience database records; remove only this application's vectors from its dedicated Pinecone index or namespace and the corresponding ingestion records; re-ingest each saved URL/audience pair; and verify retrieval for all three audiences. Never clear a shared index or unrelated data. This is an operator procedure, not an automatic deployment action.
A selective rebuild can instead remove vectors using both URL and audience metadata filters, remove the corresponding ingestion record, and re-ingest that pair. Metadata-based deletion can match both legacy and new IDs.
Streaming behaviour
The query endpoint streams plain text. HTTP 200 and X-AI-Status: answered are sent before generation finishes and do not guarantee successful completion. Clients must consume the body through clean EOF and handle stream-read errors, including failures after receiving partial text.
Only normally completed, uncancelled assistant responses are saved to history. The original user question may remain if generation fails. Message persistence is best effort: a failed history write does not invalidate an otherwise completed answer.
Known limitations
- Non-atomic ingestion replacement: Existing vectors may be deleted before replacement embeddings/upserts succeed. Failed or partial upserts can leave content missing or incomplete. There is no activation/rollback mechanism yet.
- Cross-store consistency: Pinecone and the external database API have no shared transaction; concurrent ingestion and cleanup are not fully protected.
- Legacy vector migration: Existing IDs are not automatically migrated; see Data migration and re-ingestion.
- Conversation authorization: The shared API key does not implement per-user ownership. A public demo should not expose arbitrary conversation history through an open proxy.
- Streaming edge cases: Intermediaries that silently convert a failed stream into clean EOF cannot be detected without an explicit terminal event protocol. Retrieval and DB operations are not currently cancellable.
- Integration testing: Unit tests mock external services. Real-world Pinecone consistency, OpenAI abort timing, and browser disconnects still need end-to-end verification.
Repository relationship
This repository contains the backend API. The frontend is maintained separately. Keep API credentials in server-side environments and route privileged operations through appropriately protected server-side code.