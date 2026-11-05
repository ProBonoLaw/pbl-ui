import { resolve4 } from 'node:dns/promises';
import { execFileSync } from 'node:child_process';

const { API_ORIGIN_HOSTNAME: hostname, K8S_NAMESPACE: namespace,
  AKS_RESOURCE_GROUP: group, AKS_CLUSTER_NAME: cluster, AZURE_SUBSCRIPTION_ID: subscription } = process.env;
if (!/^[a-z0-9.-]+\.probono-law\.com$/.test(hostname ?? '') || !/^[a-z0-9-]+$/.test(namespace ?? '')) {
  throw new Error('Invalid public API origin or namespace');
}
const problems = [];
try { await resolve4(hostname); }
catch { problems.push(`Public API DNS is missing: ${hostname}`); }
const result = JSON.parse(execFileSync('az', [
  'aks', 'command', 'invoke', '--resource-group', group, '--name', cluster,
  '--subscription', subscription, '--output', 'json',
  '--command', `kubectl get secret portal-api-tls -n ${namespace} -o jsonpath='{.type}' | grep -Fx 'kubernetes.io/tls'`,
], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
if (result.exitCode !== 0) {
  console.error('AKS TLS check failed:', {
    exitCode: result.exitCode, provisioningState: result.provisioningState,
  });
  if (result.logs) console.error(result.logs);
  problems.push(`A Kubernetes TLS secret named portal-api-tls is required in ${namespace}`);
}
if (problems.length) throw new Error(problems.join('\n'));
console.log('Public API DNS and TLS secret prerequisites are present');
