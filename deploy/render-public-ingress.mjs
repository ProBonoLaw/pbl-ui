import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Matches infrastructure PR #76's dedicated controller. The existing private
// AIMIE controller is deliberately untouched.
const { API_ORIGIN_HOSTNAME: hostname, API_PUBLIC_IP_NAME: ipName, AKS_RESOURCE_GROUP: group,
  K8S_NAMESPACE: namespace, DEPLOY_OUTPUT_DIR: directory } = process.env;
if (!/^[a-z0-9.-]+\.probono-law\.com$/.test(hostname ?? '') || !/^[a-z0-9-]+$/.test(ipName ?? '') ||
  !/^[a-zA-Z0-9_.()-]+$/.test(group ?? '') || !/^[a-z0-9-]+$/.test(namespace ?? '')) {
  throw new Error('Invalid public ingress deployment configuration');
}
await writeFile(join(directory, 'public-controller.json'), JSON.stringify({
  apiVersion: 'approuting.kubernetes.azure.com/v1alpha1', kind: 'NginxIngressController',
  metadata: { name: 'portal-public' },
  spec: {
    ingressClassName: 'portal-public', controllerNamePrefix: 'portal-public',
    loadBalancerAnnotations: {
      'service.beta.kubernetes.io/azure-pip-name': ipName,
      'service.beta.kubernetes.io/azure-load-balancer-resource-group': group,
      'service.beta.kubernetes.io/azure-allowed-service-tags': 'AzureFrontDoor.Backend',
    },
  },
}));
await writeFile(join(directory, 'public-ingress.json'), JSON.stringify({
  apiVersion: 'networking.k8s.io/v1', kind: 'Ingress',
  metadata: { name: 'portal-api', namespace, annotations: {
    'nginx.ingress.kubernetes.io/proxy-body-size': '251000000',
    'nginx.ingress.kubernetes.io/proxy-read-timeout': '240',
    'nginx.ingress.kubernetes.io/proxy-send-timeout': '240',
    'nginx.ingress.kubernetes.io/ssl-redirect': 'true',
  } },
  spec: {
    ingressClassName: 'portal-public',
    tls: [{ hosts: [hostname], secretName: 'portal-api-tls' }],
    rules: [{ host: hostname, http: { paths: [{ path: '/api', pathType: 'Prefix',
      backend: { service: { name: 'pb-law-backend', port: { number: 80 } } },
    }] } }],
  },
}));
