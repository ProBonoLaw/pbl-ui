"""Configure environment-scoped GitHub OIDC and AKS workload identities.

Run with Azure role-assignment privileges and GitHub environment variable access:
  python3 deploy/azure/configure-cicd.py --environment Test --repo OWNER/REPOSITORY --config /path/to/private-inventory.json
"""
import argparse
import json
import shutil
import subprocess
import tempfile
from pathlib import Path


def command(args, *, json_output=True):
    executable = shutil.which(args[0])
    if not executable:
        raise RuntimeError(f'{args[0]} is required on PATH')
    result = subprocess.run([executable, *args[1:]], check=True, capture_output=True, text=True)
    return json.loads(result.stdout) if json_output else result.stdout.strip()


def kubernetes_ci_permissions(namespace, client_id, principal_id):
    """Limit the CI identity to the portal release and its existing controller."""
    metadata = {'name': 'pb-law-ui-ci', 'namespace': namespace}
    subjects = [{'kind': 'User', 'name': identifier, 'apiGroup': 'rbac.authorization.k8s.io'}
                for identifier in sorted({client_id, principal_id})]
    resources = [
        {
            'kind': 'Role', 'metadata': metadata,
            'rules': [
                {'apiGroups': [''], 'resources': ['secrets'], 'resourceNames': ['portal-api-tls'],
                 'verbs': ['get']},
                {'apiGroups': [''], 'resources': ['configmaps', 'serviceaccounts', 'services'],
                 'verbs': ['get', 'list', 'watch', 'create', 'update', 'patch']},
                {'apiGroups': [''], 'resources': ['pods', 'events'], 'verbs': ['get', 'list', 'watch']},
                {'apiGroups': ['apps'], 'resources': ['deployments'],
                 'verbs': ['get', 'list', 'watch', 'create', 'update', 'patch']},
                {'apiGroups': ['apps'], 'resources': ['replicasets'], 'verbs': ['get', 'list', 'watch']},
                {'apiGroups': ['networking.k8s.io'], 'resources': ['ingresses'],
                 'verbs': ['get', 'list', 'watch', 'create', 'update', 'patch']},
                {'apiGroups': ['secrets-store.csi.x-k8s.io'], 'resources': ['secretproviderclasses'],
                 'verbs': ['get', 'list', 'watch', 'create', 'update', 'patch']},
            ],
        },
        {'kind': 'RoleBinding', 'metadata': metadata, 'subjects': subjects,
         'roleRef': {'apiGroup': 'rbac.authorization.k8s.io', 'kind': 'Role', 'name': 'pb-law-ui-ci'}},
        {
            'kind': 'ClusterRole', 'metadata': {'name': 'pb-law-ui-ci-' + namespace},
            'rules': [
                {'apiGroups': [''], 'resources': ['namespaces'], 'resourceNames': [namespace],
                 'verbs': ['get', 'update', 'patch']},
                {'apiGroups': ['approuting.kubernetes.azure.com'], 'resources': ['nginxingresscontrollers'],
                 'resourceNames': ['portal-public'], 'verbs': ['get', 'update', 'patch']},
            ],
        },
        {'kind': 'ClusterRoleBinding', 'metadata': {'name': 'pb-law-ui-ci-' + namespace},
         'subjects': subjects, 'roleRef': {'apiGroup': 'rbac.authorization.k8s.io',
                                        'kind': 'ClusterRole', 'name': 'pb-law-ui-ci-' + namespace}},
    ]
    return {'apiVersion': 'v1', 'kind': 'List',
            'items': [{'apiVersion': 'rbac.authorization.k8s.io/v1', **item} for item in resources]}


def configure(environment, config, repository):
    subscription = config['subscription']

    def az(*args, json_output=True):
        return command(['az', *args, '--subscription', subscription, '--only-show-errors',
                        '--output', 'json' if json_output else 'none'], json_output=json_output)

    static_site = az('staticwebapp', 'show', '-g', config['portalResourceGroup'], '-n', config['staticSite'])
    storage = az('storage', 'account', 'show', '-g', config['storageResourceGroup'], '-n', config['storageAccount'])
    cluster = az('aks', 'show', '-g', config['clusterResourceGroup'], '-n', config['cluster'])
    registry = az('acr', 'show', '-n', config['registry'], '-g', config['registryResourceGroup'])
    issuer = cluster.get('oidcIssuerProfile', {}).get('issuerUrl')
    if not issuer or not cluster.get('securityProfile', {}).get('workloadIdentity', {}).get('enabled'):
        raise RuntimeError('The target AKS cluster must have OIDC and workload identity enabled')
    if cluster.get('apiServerAccessProfile', {}).get('disableRunCommand'):
        raise RuntimeError('AKS Run Command is disabled on the target cluster')
    if registry.get('roleAssignmentMode') == 'AbacRepositoryPermissions':
        raise RuntimeError('This bootstrap expects an ACR registry using legacy registry RBAC')

    suffix = 'test' if environment == 'Test' else 'prod'
    tenant = az('account', 'show')['tenantId']

    def identity(name, group):
        identities = az('identity', 'list', '-g', group)
        existing = next((item for item in identities if item['name'] == name), None)
        if existing:
            return existing
        print(f'{environment}: creating managed identity {name}', flush=True)
        return az('identity', 'create', '-g', group, '-n', name)

    ci_identity = identity('probonolaw-ui-ci-' + suffix, config['portalResourceGroup'])
    runtime_identity = identity('probonolaw-ui-runtime-' + suffix, config['clusterResourceGroup'])

    def federation(identity_record, name, issuer_url, subject):
        group = identity_record['resourceGroup']
        name_of_identity = identity_record['name']
        credentials = az('identity', 'federated-credential', 'list', '-g', group,
                         '--identity-name', name_of_identity)
        if any(item['issuer'] == issuer_url and item['subject'] == subject for item in credentials):
            return
        az('identity', 'federated-credential', 'create', '-g', group,
           '--identity-name', name_of_identity, '-n', name, '--issuer', issuer_url,
           '--subject', subject, '--audiences', 'api://AzureADTokenExchange', json_output=False)

    federation(ci_identity, 'github-' + suffix, 'https://token.actions.githubusercontent.com',
               f'repo:{repository}:environment:{environment}')
    federation(runtime_identity, 'aks-' + suffix, issuer,
               f"system:serviceaccount:{config['namespace']}:pb-law-backend")

    role_name = 'ProBonoLaw UI AKS Run Command ' + environment
    roles = az('role', 'definition', 'list', '--name', role_name)
    if not roles:
        role = {
            'Name': role_name, 'IsCustom': True,
            'Description': 'Deploy the ProBonoLaw UI through AKS Run Command',
            'Actions': [
                'Microsoft.ContainerService/managedClusters/read',
                'Microsoft.ContainerService/managedClusters/runCommand/action',
                'Microsoft.ContainerService/managedClusters/commandResults/read',
            ],
            'NotActions': [],
            'AssignableScopes': [f"/subscriptions/{subscription}/resourceGroups/{config['clusterResourceGroup']}"],
        }
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory, 'role.json')
            path.write_text(json.dumps(role))
            roles = [az('role', 'definition', 'create', '--role-definition', str(path))]
    ci_role_id = roles[0]['id']

    static_role_name = 'ProBonoLaw UI Static Deployment ' + environment
    static_roles = az('role', 'definition', 'list', '--name', static_role_name)
    if not static_roles:
        static_role = {
            'Name': static_role_name, 'IsCustom': True,
            'Description': 'Read the portal Static Web App and obtain its deployment token',
            'Actions': ['Microsoft.Web/staticSites/read', 'Microsoft.Web/staticSites/listSecrets/action'],
            'NotActions': [], 'DataActions': [], 'NotDataActions': [],
            'AssignableScopes': [f"/subscriptions/{subscription}/resourceGroups/{config['portalResourceGroup']}"],
        }
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory, 'static-role.json')
            path.write_text(json.dumps(static_role))
            static_roles = [az('role', 'definition', 'create', '--role-definition', str(path))]

    def assign(principal, role, scope):
        role_id = role if '/roleDefinitions/' in role else az('role', 'definition', 'list', '--name', role)[0]['id']
        existing = az('role', 'assignment', 'list', '--scope', scope)
        if any(item['principalId'] == principal and item['roleDefinitionId'].split('/')[-1] == role_id.split('/')[-1] for item in existing):
            return
        az('role', 'assignment', 'create', '--assignee-object-id', principal,
           '--assignee-principal-type', 'ServicePrincipal', '--role', role_id,
           '--scope', scope, json_output=False)

    assign(ci_identity['principalId'], static_roles[0]['id'], static_site['id'])
    assign(ci_identity['principalId'], 'AcrPush', registry['id'])
    assign(ci_identity['principalId'], 'Reader', registry['id'])
    assign(ci_identity['principalId'], ci_role_id, cluster['id'])
    assign(cluster['identityProfile']['kubeletidentity']['objectId'], 'AcrPull', registry['id'])

    # Run Command forwards the caller's Entra identity on managed-AAD clusters.
    # Its Azure management role does not grant Kubernetes data access.
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory, 'ci-rbac.json')
        path.write_text(json.dumps(kubernetes_ci_permissions(
            config['namespace'], ci_identity['clientId'], ci_identity['principalId'])))
        result = az('aks', 'command', 'invoke', '-g', config['clusterResourceGroup'],
                    '-n', config['cluster'], '--file', str(path),
                    '--command', 'kubectl apply -f ci-rbac.json')
        if result.get('exitCode') != 0:
            raise RuntimeError('Cannot configure CI Kubernetes access: ' + result.get('logs', str(result)))

    for role in ['Storage Blob Data Contributor', 'Storage Table Data Contributor']:
        assign(runtime_identity['principalId'], role, storage['id'])

    variables = {
        'AZURE_CLIENT_ID': ci_identity['clientId'], 'AZURE_TENANT_ID': tenant,
        'AZURE_SUBSCRIPTION_ID': subscription, 'STATIC_SITE_NAME': config['staticSite'],
        'PORTAL_RESOURCE_GROUP': config['portalResourceGroup'], 'AKS_CLUSTER_NAME': config['cluster'],
        'AZURE_FRONT_DOOR_ID': config['frontDoorId'], 'FRONT_DOOR_HOSTNAME': config['frontDoorHostname'],
        'API_ORIGIN_HOSTNAME': config['apiOriginHostname'], 'API_PUBLIC_IP_NAME': config['apiPublicIpName'],
        'KEY_VAULT_NAME': config['keyVault'],
        'AKS_RESOURCE_GROUP': config['clusterResourceGroup'], 'ACR_NAME': config['registry'],
        'ACR_RESOURCE_GROUP': config['registryResourceGroup'],
        'K8S_NAMESPACE': config['namespace'], 'K8S_AZURE_CLIENT_ID': runtime_identity['clientId'],
    }
    for name, value in variables.items():
        command(['gh', 'variable', 'set', name, '--repo', repository, '--env', environment,
                 '--body', value], json_output=False)
    print(f'{environment}: deployment and workload identities configured; GitHub variables updated', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--environment', required=True, choices=['Test', 'Production'])
    parser.add_argument('--repo', required=True)
    parser.add_argument('--config', type=Path, default=Path(__file__).parents[1] / 'private' / 'azure-environments.json')
    args = parser.parse_args()
    configurations = json.loads(args.config.read_text())
    try:
        configure(args.environment, configurations[args.environment], args.repo)
    except subprocess.CalledProcessError as error:
        raise SystemExit(error.stderr.strip() or str(error)) from error
