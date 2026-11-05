# Deployment and public development

Public development lives in [ProBonoLaw/pbl-ui](https://github.com/ProBonoLaw/pbl-ui).
The original private repository remains the only Azure deployment repository.
The public repository runs validation with mock configuration and has no Azure
credentials or deployment inventory.

## Release controls

`deploy-test.yml` releases Test after a push to private `main`, or by manual
dispatch. `deploy-production.yml` is manual. Both require a private repository
whose full name matches the repository variable `AZURE_DEPLOYMENT_REPOSITORY`.
The reusable release and AKS workflows enforce the same guard. Public forks do
not deploy, even though the reusable deployment code is available for review.

A release validates the application, builds an API container, deploys its
immutable digest to AKS, checks API health through Front Door, then publishes
the static Vite frontend to Azure Static Web Apps. Releases are serialized per
environment. GitHub OIDC and workload identity provide Azure authentication;
credentials are loaded from Key Vault in the API, not copied into the frontend.

## GitHub environment configuration

Each private `Test` and `Production` environment supplies the variables named
by `valueFrom` entries in `runtime/*.json`. These include backend service URLs,
Cosmos and Storage targets, browser authentication configuration, the Graph
attorney extension name, and `SHAREPOINT_HOST`. Missing required values fail
runtime selection. There are no committed deployment-specific defaults.

`AZURE_SHAREPOINT_READ_SCOPES` is optional. The API derives its default read
scope from `SHAREPOINT_HOST`, which must be a hostname without a scheme or path.
`NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING` is also optional: release workflows
use its environment variable, then the existing environment secret as a
fallback. Leave both empty to disable browser telemetry. A configured value is
browser-visible; GitHub storage does not make browser telemetry identifiers
private. The migration aligns the private environment variables with the former runtime
configuration, including stale service URLs and browser telemetry settings.

Deployment target variables are `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`,
`AZURE_SUBSCRIPTION_ID`, `AKS_CLUSTER_NAME`, `AKS_RESOURCE_GROUP`, `ACR_NAME`,
`ACR_RESOURCE_GROUP`, `K8S_NAMESPACE`, `K8S_AZURE_CLIENT_ID`, `KEY_VAULT_NAME`,
`AZURE_FRONT_DOOR_ID`, `FRONT_DOOR_HOSTNAME`, `API_ORIGIN_HOSTNAME`,
`API_PUBLIC_IP_NAME`, `STATIC_SITE_NAME`, and `PORTAL_RESOURCE_GROUP`.
These are managed exclusively in the private deployment repository.

## Runtime secrets and private files

`keyVaultSecret: true` in a runtime template generates a versionless reference
using `KEY_VAULT_NAME` and the naming policy in `secret-policy.json`. For example,
`WEB_PUBSUB_CONNECTION_STRING` uses the secret named
`probonolaw-ui-web-pubsub-connection-string`. The API loads the actual credential
from its CSI mount at startup. Plaintext credentials are rejected by deployment
rendering. Web PubSub credentials never enter browser build variables; signed
realtime URLs supplied to authenticated users can identify the service.

`deploy/private/` exists only in the private repository:

- `azure-environments.json` is the operator's Azure resource inventory.
- `test-root-ca.pem` is the public Test trust certificate, not its private key.
- `soc2-report.pdf` is the existing deployment-only compliance asset. Its
  publication policy is unchanged by source migration and remains an operator
  decision. It is excluded from the public repository and public builds.

Production supplies its public CA via `PRODUCTION_INTERNAL_CA_CERT_PEM` in the
Production environment. Test can alternatively supply `TEST_INTERNAL_CA_CERT_PEM`.
Never put private keys in source control. Public tests use an unrelated example
CA under `tests/fixtures/`.

For infrastructure bootstrapping, copy `azure/environments.example.json` into a
private inventory and fill it from your infrastructure outputs. Pass the
private repository explicitly:

```bash
python3 deploy/azure/configure-cicd.py --environment Test --repo OWNER/REPOSITORY --config /path/to/private-inventory.json
python3 deploy/azure/configure-keyvault.py --environment Test --repo OWNER/REPOSITORY --config /path/to/private-inventory.json
```

Bootstrap grants scoped Azure deployment roles and workload identity permissions.
The namespace, public ingress controller, DNS, TLS secret, and Front Door routing
must exist before release. Keep deployment environment protections and branch
rules in place in the private repository.

## Public imports

The private repository's import controller polls public `main`, checks the
required public validation result, and prepares a private import PR. A dedicated
repository deploy key triggers private PR validation. Only after the private
checks succeed can the import merge; the controller then dispatches private CI
and the Test release. Production remains manual. Failed checks, conflicts,
rewritten public history, and modifications to reserved private paths stop the
import. Neither repository force-pushes or mirrors all refs.

The public repository starts with new history. The initial private migration
links the approved public snapshot as an ancestor without exporting private
history. Subsequent public imports preserve the original private history and
`deploy/private/` files. The private controller and its state are not exported.
Merge the public source PR before the private migration PR so that its recorded
public baseline is present on public `main`.

To prepare another reviewable source export from the private repository:

```bash
node deploy/export-open-source.mjs /path/to/new-empty-export-directory
```

Stage new files first; the export reads tracked working-tree files. Review and
scan the resulting directory before publishing it. Never push private branches,
tags, or the original repository's Git object database to the public repository.

## Local verification

```bash
bun install --frozen-lockfile
bun run test:setup
bun run test
bun run build
bun run start
```

The frontend runs on port 3000 and the API on port 3001. Local `.env` files are
ignored. Mock UI tests need no Azure access. To reproduce the marketing image,
start the application with `.env.example` configuration and run
`bun tests/playwright/capture-workspace.ts`; it captures the actual case screen using only
mock records and blocks external network requests.
