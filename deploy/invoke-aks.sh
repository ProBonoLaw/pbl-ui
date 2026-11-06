#!/usr/bin/env bash
set -euo pipefail

# The renderer validates the namespace before it is used in the remote command.
[[ "$K8S_NAMESPACE" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]]
[[ "$DEPLOY_IMAGE" =~ ^[a-z0-9][a-z0-9.:/-]*@sha256:[a-f0-9]{64}$ ]]
result_file=$(mktemp)
trap 'rm -f "$result_file"' EXIT
cd "$DEPLOY_OUTPUT_DIR"
# The outer double quotes expand DEPLOY_IMAGE locally. The inner single quotes
# protect that expanded digest when the command runs in the cluster shell.
az aks command invoke \
  --resource-group "$AKS_RESOURCE_GROUP" --name "$AKS_CLUSTER_NAME" \
  --file . \
  --command "kubectl get secret portal-api-tls -n $K8S_NAMESPACE -o name && kubectl apply -f public-controller.json -f public-ingress.json && kubectl apply -k . && kubectl rollout status deployment/pb-law-backend -n $K8S_NAMESPACE --timeout=300s && kubectl get deployment/pb-law-backend -n $K8S_NAMESPACE -o jsonpath='{.spec.template.spec.containers[0].image}' | grep -Fx '$DEPLOY_IMAGE'" \
  --output json > "$result_file"

# The Azure CLI can succeed while the command inside the cluster fails.
node - "$result_file" <<'JS'
const result = JSON.parse(require('node:fs').readFileSync(process.argv[2], 'utf8'));
if (result.logs) process.stdout.write(result.logs);
if (result.exitCode !== 0) {
  console.error('AKS deployment command failed:', result.exitCode ?? result.provisioningState);
  process.exit(1);
}
JS
