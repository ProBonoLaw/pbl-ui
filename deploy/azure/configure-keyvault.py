"""Migrate UI credentials to the existing vault and configure runtime access.

Run after configure-cicd.py with Azure network/RBAC and vault secret-write access.
Existing vault references are preserved; reruns never overwrite rotated secrets.
"""
import argparse
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path


def configure(environment, config, repository):
    subscription = config['subscription']

    def az(*args):
        result = subprocess.run(['az', *args, '--subscription', subscription,
                                 '--only-show-errors', '--output', 'json'],
                                check=True, capture_output=True, text=True)
        return json.loads(result.stdout) if result.stdout.strip() else None

    policy = json.loads(Path(__file__).parents[1].joinpath('secret-policy.json').read_text())
    vault = az('keyvault', 'show', '--name', config['keyVault'])
    if not vault['properties'].get('enableRbacAuthorization'):
        raise RuntimeError('The existing application vault must use Azure RBAC')
    webapp = az('webapp', 'show', '-g', config['webappResourceGroup'], '-n', config['webapp'])
    principal = webapp.get('identity', {}).get('principalId')
    subnet_id = webapp.get('virtualNetworkSubnetId')
    if not principal or not subnet_id:
        raise RuntimeError('The Web App must have a managed identity and VNet integration')
    suffix = 'test' if environment == 'Test' else 'prod'
    runtime = az('identity', 'show', '-g', config['clusterResourceGroup'],
                 '-n', 'probonolaw-ui-runtime-' + suffix)

    # Preserve the firewall and existing subnet service endpoints.
    subnet = az('network', 'vnet', 'subnet', 'show', '--ids', subnet_id)
    if not any(item['service'] == 'Microsoft.KeyVault' for item in subnet.get('serviceEndpoints', [])):
        az('network', 'vnet', 'subnet', 'update', '--ids', subnet_id, '--add',
           'serviceEndpoints', json.dumps({'service': 'Microsoft.KeyVault', 'locations': ['*']}))
    rules = vault['properties']['networkAcls'].get('virtualNetworkRules', [])
    if not any(item['id'].lower() == subnet_id.lower() for item in rules):
        az('keyvault', 'network-rule', 'add', '--name', config['keyVault'], '--subnet', subnet_id)
    app_config = az('webapp', 'config', 'show', '-g', config['webappResourceGroup'], '-n', config['webapp'])
    if not app_config.get('vnetRouteAllEnabled'):
        az('webapp', 'config', 'set', '-g', config['webappResourceGroup'], '-n', config['webapp'],
           '--generic-configurations', '{"vnetRouteAllEnabled":true}')
    cluster = az('aks', 'show', '-g', config['clusterResourceGroup'], '-n', config['cluster'])
    addon = cluster.get('addonProfiles', {}).get('azureKeyvaultSecretsProvider', {})
    if not addon.get('enabled'):
        raise RuntimeError('Enable the AKS azure-keyvault-secrets-provider addon first')
    if (addon.get('config') or {}).get('enableSecretRotation') != 'true':
        az('aks', 'addon', 'update', '-g', config['clusterResourceGroup'], '-n', config['cluster'],
           '--addon', 'azure-keyvault-secrets-provider', '--enable-secret-rotation',
           '--rotation-poll-interval', '2m')

    settings = az('webapp', 'config', 'appsettings', 'list', '-g', config['webappResourceGroup'],
                  '-n', config['webapp'])
    existing_names = {item['name'] for item in az('keyvault', 'secret', 'list', '--vault-name', config['keyVault'])}
    roles = az('role', 'assignment', 'list', '--all')
    role_id = '4633458b-17de-408a-b874-0445c86b69e6'  # Key Vault Secrets User
    references = {}
    for setting in settings:
        name, value = setting['name'], setting['value']
        is_reference = value.startswith('@Microsoft.KeyVault(')
        sensitive = name != 'NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING' and (
            re.search(policy['namePattern'], name, re.I) or re.search(policy['valuePattern'], value, re.I))
        if not is_reference and (not sensitive or not value):
            continue
        secret_name = policy['secretPrefix'] + name.lower().replace('_', '-')
        reference = f"@Microsoft.KeyVault(SecretUri={vault['properties']['vaultUri']}secrets/{secret_name})"
        if is_reference and value != reference:
            raise RuntimeError(f'Unexpected existing reference for {name}; migrate it explicitly first')
        if secret_name not in existing_names:
            if is_reference:
                raise RuntimeError(f'Referenced secret {secret_name} does not exist')
            # Secret values never enter CLI arguments or command output.
            with tempfile.TemporaryDirectory() as directory:
                path = Path(directory, 'secret.txt')
                path.touch(mode=0o600)
                path.write_text(value)
                az('keyvault', 'secret', 'set', '--vault-name', config['keyVault'],
                   '--name', secret_name, '--file', str(path), '--encoding', 'utf-8')
            print(f'{environment}: stored {name} in Key Vault', flush=True)
        scope = vault['id'] + '/secrets/' + secret_name
        for identity in (principal, runtime['principalId']):
            if not any(item['principalId'] == identity and item['scope'].lower() == scope.lower()
                       and item['roleDefinitionId'].split('/')[-1] == role_id for item in roles):
                az('role', 'assignment', 'create', '--assignee-object-id', identity,
                   '--assignee-principal-type', 'ServicePrincipal', '--role', role_id, '--scope', scope)
        references[name] = reference
    if not references:
        raise RuntimeError('No application secrets were found to migrate')
    if any(setting['name'] in references and setting['value'] != references[setting['name']] for setting in settings):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory, 'references.json')
            path.write_text(json.dumps(references))
            az('webapp', 'config', 'appsettings', 'set', '-g', config['webappResourceGroup'],
               '-n', config['webapp'], '--settings', '@' + str(path))
    subprocess.run(['gh', 'variable', 'set', 'KEY_VAULT_NAME', '--repo', repository,
                    '--env', environment, '--body', config['keyVault']], check=True, capture_output=True)
    subprocess.run(['node', 'deploy/verify-keyvault.mjs'], check=True,
                   env={**os.environ, 'WEBAPP_NAME': config['webapp'],
                        'WEBAPP_RESOURCE_GROUP': config['webappResourceGroup'],
                        'AZURE_SUBSCRIPTION_ID': subscription, 'KEY_VAULT_NAME': config['keyVault']})
    print(f'{environment}: {len(references)} Key Vault references configured and verified', flush=True)


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
        # Secret operations use files and captured output; avoid dumping JSON values.
        raise SystemExit(f'Key Vault configuration command failed (exit {error.returncode}); no secret values were logged') from None
