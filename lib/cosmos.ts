import { Container, CosmosClient } from "@azure/cosmos";

let _client: CosmosClient | null = null;

export function getCosmosContainer(container?: string): Container {
  if (!_client) {
    _client = new CosmosClient({
      endpoint: process.env.COSMOS_SQL_ENDPOINT!,
      key: process.env.COSMOS_SQL_KEY!,
    });
  }
  const db = _client.database(process.env.COSMOS_SQL_DB!);
  if (container) {
    return db.container(container);
  }
  return db.container(process.env.COSMOS_SQL_CONTAINER!);
}