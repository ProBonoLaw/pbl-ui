# probonolaw-ui

The primary UI portal for ProBono-Law.com. Public development takes place in
[ProBonoLaw/pbl-ui](https://github.com/ProBonoLaw/pbl-ui). Azure deployments run
only from the private deployment repository; see [deployment](deploy/README.md).

## License

This project is licensed under the [Apache License, Version 2.0](LICENSE).

## Known Configuration

### React Compiler (Auto-Memoization)

This project enables React Compiler for automatic memoization.

- Next.js config: `reactCompiler: true` in `next.config.ts`
- Static frontend: the React Compiler Babel plugin in `vite.config.ts`
- Required plugin: `babel-plugin-react-compiler` in `devDependencies`

## Environment Variables

Server settings are consumed by the AKS API. Cloud secrets are mounted from
Key Vault; nonsecret settings and references live in `deploy/runtime/`. The
static frontend receives only allowlisted `NEXT_PUBLIC_*` browser configuration.

Below is a list of environment variables used in this project:

| Parameter                                             | Description                                                                 | Default Value                     |
| ----------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------- |
| AIMIE_QA_FORMATTING_URL                               | URL for AIMIE QA formatting service                                         | None                              |
| AIMIE_QA_KEY                                          | Key for AIMIE QA service                                                    | None                              |
| AIMIE_QA_SUBSCRIPTION_KEY                             | Subscription key for AIMIE QA service                                       | None                              |
| AIMIE_QA_URL                                          | URL for AIMIE QA interaction service                                        | None                              |
| AIMIE_EVIDENCE_SEARCH_URL                             | URL for the AIMIE evidence search endpoint                                  | None                              |
| AIMIE_EVIDENCE_FUNCTION_KEY                           | Optional Azure Function app key for AIMIE evidence search                  | None                              |
| AIMIE_REALTIME_TIMELINE_SUBSCRIPTION_KEY              | Subscription key for the AIMIE Timeline service                             | None                              |
| AIMIE_REALTIME_TIMELINE_URL                           | URL for the AIMIE realtime Timeline service                                 | None                              |
| APPLICATIONINSIGHTS_CONNECTION_STRING                 | Connection string for Application Insights                                  | None                              |
| ApplicationInsightsAgent_EXTENSION_VERSION            | Version of Application Insights Agent                                       | ~3                                |
| AZURE_AD_AUDIENCE                                     | Azure AD audience ID                                                        | None                              |
| AZURE_CLIENT_SECRET                                   | Azure client secret                                                         | None                              |
| AZURE_EVENT_ACCOUNT_OPERATIONS_HUB_NAME               | Event hub name for account operations                                       | account-operations                |
| AZURE_EVENT_FILE_INGESTION_CONNECTION_STRING          | Optional Event Hubs connection string for file re-ingestion                 | Account management connection     |
| AZURE_EVENT_FILE_INGESTION_HUB_NAME                   | Event hub name for file re-ingestion events                                 | file-operations                   |
| AZURE_EVENT_HUB_ACCOUNT_MANAGEMENT_CONNECTION_STRING  | Connection string for Azure Event Hub account management                    | None                              |
| AZURE_EVENT_HUB_CONNECTION_STRING                     | Connection string for Azure Event Hub                                       | None                              |
| AZURE_EVENT_REQUESTS_HUB_NAME                         | Event hub name for requests                                                 | aimie-request-queue               |
| BETA_TESTER_TABLE_NAME                                | Azure Table name for beta tester signups                                    | betatester                        |
| COSMOS_DB_AIMIE_STATS_CONTAINER                       | Cosmos DB container for AIMIE query stats                                   | aimie-query-stats                 |
| COSMOS_DB_USAGE_CONTAINER                             | Cosmos DB container for LLM usage data                                      | usage                             |
| COSMOS_SQL_CONTAINER                                  | Cosmos DB container name                                                    | accounts                          |
| COSMOS_SQL_CLIENT_FEEDBACK_REQUEST_CONTAINER          | Cosmos DB container for client feedback requests                            | clientFeedbackRequests            |
| COSMOS_SQL_DB                                         | Cosmos DB name                                                              | db_conversation_history           |
| COSMOS_SQL_ENDPOINT                                   | Cosmos DB endpoint                                                          | None                              |
| COSMOS_SQL_KEY                                        | Cosmos DB key                                                               | None                              |
| COSMOS_SQL_NOTIFICATIONS_CONTAINER                    | Cosmos DB notifications container name                                      | notices                           |
| DEMO_ACCOUNT_IDS                                      | Comma-delimited demo case account IDs offered to users with no active cases | None                              |
| COSMOS_SQL_REQUESTS_CONTAINER                         | Cosmos DB requests container name                                           | requests                          |
| LEGAL_DOCUMENT_ARCHIVE_PATH                           | Path to the immutable legal agreement archive                               | archives/TermsAndAgreements.zip   |
| NEXT_PUBLIC_AAD_ATTORNEY_EXTENSION                   | Directory extension field name for attorney status                          | Synthetic field for local tests  |
| NEXT_PUBLIC_AAD_API_SCOPE                             | API scope for Azure AD                                                      | None                              |
| NEXT_PUBLIC_AAD_CLIENT_ID                             | Client ID for Azure AD                                                      | None                              |
| NEXT_PUBLIC_AAD_REDIRECT_URI                          | Redirect URI for Azure AD                                                   | http://localhost:3000             |
| NEXT_PUBLIC_AAD_TENANT_ID                             | Tenant ID for Azure AD                                                      | None                              |
| NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING             | Optional browser telemetry configuration from a GitHub variable or secret; browser-visible when enabled | Empty (disabled)                  |
| NEXT_PUBLIC_SUPPORT_EMAIL                            | Public support address for email links, including SOC 2 report requests; set before building | None (request links unavailable) |
| NODE_EXTRA_CA_CERTS                                   | Environment-specific server trust bundle for private AKS ingress            | None                              |
| NEWSLETTER_TABLE_NAME                                 | Azure Table name for newsletter signups                                     | newsletter                        |
| SHAREPOINT_HOST                                       | SharePoint hostname from the GitHub environment variable of the same name   | Required for deployment           |
| AZURE_SHAREPOINT_READ_SCOPES                           | Optional comma-separated delegated SharePoint read scopes                  | Derived from SHAREPOINT_HOST      |
| STAFF_PHOTO_CONTAINER_NAME                            | Blob container for staff photos                                             | staff-photos                      |
| STAFF_TABLE_NAME                                      | Azure Table name for staff metadata                                         | staff                             |
| STORAGE_ACCOUNT_NAME                                  | Azure Storage account for staff, jurisdictions, signups, and feedback       | None                              |
| WEB_PUBSUB_CONNECTION_STRING                          | Server-only Web PubSub credential loaded from Key Vault using KEY_VAULT_NAME | None                              |
| WEB_PUBSUB_HUB                                        | Hub name for Web PubSub                                                     | notification                      |
| XDT_MicrosoftApplicationInsights_Mode                 | Mode for Application Insights                                               | default                           |

## Azure Storage

Set `STORAGE_ACCOUNT_NAME` in each private GitHub deployment environment.
Local integration testing uses the same variable in an ignored `.env` file.

Blob and Table clients authenticate through RBAC using `DefaultAzureCredential`.
AKS uses its runtime workload identity, which needs **Storage Blob Data
Contributor** and **Storage Table Data Contributor** on the matching account.
The [deployment setup](deploy/README.md#azure-and-github-identities) grants these
roles. Existing tables and blobs must be migrated before switching a live
environment; changing the account setting does not copy data.

## Internal TLS

The private deployment repository supplies each environment's public CA
certificate. Private keys stay in Key Vault. Deployment tooling validates the
certificate and mounts it as the API trust bundle. Public tests use a generated
example CA, and public builds require no internal certificate.

## Consolidated Event Hubs

When switching an environment to the consolidated Event Hubs namespace, set `AZURE_EVENT_HUB_CONNECTION_STRING` and `AZURE_EVENT_HUB_ACCOUNT_MANAGEMENT_CONNECTION_STRING` to the namespace's `PB-UI` SAS connection string. If `AZURE_EVENT_FILE_INGESTION_CONNECTION_STRING` is set separately, update it as well. Set `AZURE_EVENT_FILE_INGESTION_HUB_NAME` to `file-operations`, or remove it to use the new default; an existing `file-ingestion` override still takes precedence. Keep the connection strings in the environment's secure app settings or deployment secrets; do not commit them. The `PB-UI` policy needs Send permission only.

The UI sends account initialization, cleanup, SharePoint access grant/revoke, and case-user linking events to `account-operations` by default with their existing `eventKind` payloads. Set `AZURE_EVENT_ACCOUNT_OPERATIONS_HUB_NAME` to use a different hub for all of these events. The former five per-operation hub-name settings are no longer read, so a stale setting cannot send these events to a retired hub. Deploy `Account-Operations-Router` before releasing this UI change. Keep `State-Events-Router` while events already queued in `state-events` are drained, then remove the old router and hub. The account router must handle the former state-events event kinds before Logic App producers switch hubs. The temporary duplicate account hubs in the consolidated namespace are removed to stay within the Standard namespace limit.

## Legal documents

Public project links point to the [ProBonoLaw organization](https://github.com/ProBonoLaw).
Deployments must designate account-support, privacy-request, and legal-notice
channels and communicate them to their users. The bundled agreements refer to
these provider-designated channels instead of publishing fixed contact details.

The terms and privacy policy use Markdown in `lib/terms-of-service-agreements/`.
The BAA, DPA, AUP, and end-client agreement pages use the versioned documents in
`archives/TermsAndAgreements.zip` by default. `LEGAL_DOCUMENT_ARCHIVE_PATH`
can override that path. Keep the document versions in `lib/legalDocuments.ts`
in sync when revising the bundled policies. CI includes the archive in the
standalone deployment package.

## Feedback Center prompts

The Feedback Center lists speaker-name feedback requests from the
`clientFeedbackRequests` Cosmos DB container. Feedback prompts are owned by the
global application menu so a single prompt is shown regardless of the current
page:

- A Web PubSub `ALERT` notice with `FEEDBACK_REQUIRED` or
  `FEEDBACK_REQUESTED` opens the feedback prompt immediately.
- On sign-in, the app also checks for the newest feedback request that is owned
  by the user, is not `completed`, and was created less than three days ago.
  When one exists, it opens the same prompt.
- The Notifications page lists alert notices and links to their feedback
  request, but does not open a second feedback prompt.

## Generated request history

The Arguments, Declarations, and investigative Timeline pages list requests
owned by the signed-in user for the current case. Their request actions use the
following endpoints:

- `GET /api/accounts/cases/{caseId}/requests?requestType=argument-builder` and
  `?requestType=declaration` return compact records containing `id`,
  `accountId`, `sessionId`, `input`, `type`, `status`, `oid`, `startedAt`, and
  optional `endedAt`. The list query and response omit `output`, `contents`,
  and other detail fields. An empty list returns 404.
- `GET /api/accounts/cases/{caseId}/requests/{requestId}` returns the full
  request for the detail view, including available output and contents.
- `DELETE /api/accounts/cases/{caseId}/requests/{requestId}` requires case
  access and request ownership. It accepts argument, declaration, and timeline
  requests and removes the Cosmos DB request record only; it does not remove
  associated files. A successful deletion returns 204.

Resubmit queues a new request with the original input and a new session ID;
the previous request remains until explicitly deleted. The list shows **View**
only for `completed` requests. A `started` request is displayed as **Overdue**
after more than two hours, without changing its stored status. The API's
`status` query parameter filters stored statuses, so `overdue` is a UI filter
only.

## Local Testing Notes

Use [Bun 1.4.2](https://bun.com/docs/installation), matching the devcontainer,
Docker image, and CI test runner. Keep Node.js 22.12 or newer installed for
Playwright and Azure tooling. All package dependencies are available from the public npm registry. No private
registry credentials are needed for installation or Docker builds.

```bash
bun install --frozen-lockfile
bun run test:setup
```

If you do not already have a `.env`, copy the local defaults from `.env.example`:

```bash
cp .env.example .env
```

The example uses placeholder authentication values for UI tests. For interactive
Azure login and backend integration, replace them with your TEST configuration
and add the backend settings listed above. The Azure app registration must allow
`http://localhost:3000` as a redirect URI.

```bash
bun run test
bun run lint
bun run dev
```

Open `http://localhost:3000` for interactive testing. The devcontainer installs
the pinned Bun version, dependencies, and Chromium, including its Linux libraries,
when created. Rebuild an existing devcontainer to apply the setup changes. Run
`bun run test:setup` in an existing container to install any missing browser
dependencies.

The development and local production servers run under Bun. `bun run test` uses
Bun's native test runner and selects the unit tests separately from Playwright.
For a local production build and server, run:

```bash
bun --bun run build
bun run start
```

`bun run dev` starts the Vite frontend on port 3000 and the Next.js API on
port 3001. Browser requests to `/api/*` are proxied to the API, matching Front
Door routing. `bun run start` serves the built static UI and packaged API with
Bun. Use `PORT=3100 API_PORT=3101 bun run start` to choose different ports.
The API origin serves only `/api/*`; open the frontend port for the UX.

`bun.lock` is the dependency lockfile for local development and Docker builds.
`package-lock.json` remains available for Node package tooling; keep both
lockfiles updated when changing dependencies. CI installs and tests with Bun.

For VS Code debugging, select **Bun: debug full stack** in Run and Debug and
press F5. This starts the API under the Bun debugger on port 3001, starts the
static frontend on port 3000, and opens the Chrome debugger after the frontend
is ready. The devcontainer includes the `oven.bun-vscode` extension. Stop any
existing development server or run `docker compose down` first to free the ports.
**Bun: debug API** starts only the API; **UX: debug browser** attaches to the
frontend you already have running. The API debug entry point keeps its handlers
in the inspected process so breakpoints reach API code.

To develop against a live environment, use the operator-provided configuration
in an ignored `.env` file. Run `az login`, set `AZURE_TOKEN_CREDENTIALS=AzureCliCredential`,
and obtain Blob/Table RBAC and network access from the deployment administrator.

## E2E Tests (Playwright)

To activate and run end-to-end tests:

1. Install dependencies:
   `bun install --frozen-lockfile`
2. Install Chromium and its system dependencies (first time only):
   `bun run test:setup`
3. Make sure port `3000` is free if Playwright will start the app for you.
4. Run e2e tests:
   `bun run test:e2e`

Run a single spec:

`bun run test:e2e tests/playwright/notifications.spec.ts`

Run against an already-running app (skip Playwright webServer):

`PLAYWRIGHT_BASE_URL=http://localhost:3000 bun run test:e2e`

When Playwright starts the app, it supplies mock authentication settings, disables
telemetry, and uses the checked-in legal archive. Tests provide their own mock
API responses. An already-running app keeps the configuration it started with.

Playwright uses one worker by default for predictable browser runs. To override this for a prebuilt or more
powerful test server, set `PLAYWRIGHT_WORKERS`, for example:

`PLAYWRIGHT_WORKERS=4 bun run test:e2e`

## CI/CD

Pull requests run lint, unit tests, the production build, and the complete
Playwright suite against the packaged production server. The Test workflow
deploys the API to AKS and the static frontend to Static Web Apps after pushes
to `main`; Production deploys both targets when manually dispatched. Front Door
serves static UI paths and routes `/api/*` to the AKS API. Both releases use the same validation
workflow, package legal content and the environment CA, and authenticate to
Azure using GitHub OIDC.

See [deployment setup and environment targets](deploy/README.md) for the Azure
identities, GitHub variables, registry publishing, and Kubernetes rollout.

## Containerized local UI and API

Compose builds a static frontend and a separate Bun API container. Only the
frontend publishes port 3000, and it proxies `/api/*` to the API container.
The local `.env` supplies public build configuration and API runtime settings.
Dependency installation uses the public npm registry.

```bash
docker compose up --build -d
docker compose logs -f ui api
PLAYWRIGHT_BASE_URL=http://localhost:3000 bun run test:e2e
```

For mock testing with the example configuration:

```bash
PB_LAW_ENV_FILE=.env.example docker compose --env-file .env.example up --build -d
```

Run `docker compose down` to stop both containers. Rebuild after changing code
or public browser configuration. The root Dockerfile's default `runner` target
builds the AKS API image; its `static` target packages the frontend for local
Compose testing. Cloud frontend deployment publishes `out/` directly to Static
Web Apps. Neither the static artifact nor its container receives API secrets.
