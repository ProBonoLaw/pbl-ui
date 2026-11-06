import { logger } from '@/lib/logger';
import {
  JurisdictionsResponseSchema,
  type FederalJurisdiction,
  type StateJurisdiction,
  type TribalJurisdiction,
} from '@/lib/types';
import { DefaultAzureCredential } from '@azure/identity';
import { TableClient } from '@azure/data-tables';
import { NextResponse } from 'next/server';

const DEFAULT_STATE_TABLE_NAME = 'statejurisdictions';
const DEFAULT_FEDERAL_TABLE_NAME = 'federaljurisdictions';
const DEFAULT_TRIBAL_TABLE_NAME = 'tribaljurisdictions';

type AzureTableEntity = Record<string, unknown> & {
  rowKey?: string;
};

function stringValue(
  entity: AzureTableEntity,
  property: string,
): string | undefined {
  const value = entity[property];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function booleanValue(
  entity: AzureTableEntity,
  property: string,
): boolean | undefined {
  const value = entity[property];
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return undefined;
}

async function listEntities(tableName: string): Promise<AzureTableEntity[]> {
  const accountName = process.env.STORAGE_ACCOUNT_NAME;
  if (!accountName) {
    throw new Error('Missing STORAGE_ACCOUNT_NAME environment variable');
  }

  const tableClient = new TableClient(
    `https://${accountName}.table.core.windows.net`,
    tableName,
    new DefaultAzureCredential(),
  );
  const entities: AzureTableEntity[] = [];
  for await (const entity of tableClient.listEntities<AzureTableEntity>()) {
    entities.push(entity);
  }
  return entities;
}

function mapStateJurisdiction(
  entity: AzureTableEntity,
): StateJurisdiction | null {
  // State jurisdiction codes are the Azure Table RowKey by definition.
  const jurisdictionCode = stringValue(entity, 'rowKey');
  const countryCode = stringValue(entity, 'countryCode');
  const name = stringValue(entity, 'name');
  const type = stringValue(entity, 'type');
  if (!jurisdictionCode || !countryCode || !name || !type) {
    return null;
  }

  return { jurisdictionCode, countryCode, name, type };
}

function mapFederalJurisdiction(
  entity: AzureTableEntity,
): FederalJurisdiction | null {
  // Selectors persist the Azure Table RowKey while presenting the name field.
  const jurisdictionCode = stringValue(entity, 'rowKey');
  const countryCode = stringValue(entity, 'countryCode');
  const courtType = stringValue(entity, 'courtType');
  const jurisdictionType = stringValue(entity, 'jurisdictionType');
  const name = stringValue(entity, 'name');
  if (
    !jurisdictionCode ||
    !countryCode ||
    !courtType ||
    !jurisdictionType ||
    !name
  ) {
    return null;
  }

  return {
    jurisdictionCode,
    countryCode,
    courtType: courtType as FederalJurisdiction['courtType'],
    jurisdictionType,
    name,
    stateCode: stringValue(entity, 'stateCode'),
    circuitCode:
      stringValue(entity, 'circuitCode') ?? stringValue(entity, 'circutCode'),
    parentDistrictCode: stringValue(entity, 'parentDistrictCode'),
    parentDistrictCodes: stringValue(entity, 'parentDistrictCodes'),
    nationwide: booleanValue(entity, 'nationwide') ?? null,
  };
}

function mapTribalJurisdiction(
  entity: AzureTableEntity,
): TribalJurisdiction | null {
  // Tribal jurisdiction codes are the Azure Table RowKey by definition.
  const jurisdictionCode = stringValue(entity, 'rowKey');
  const countryCode = stringValue(entity, 'countryCode');
  const jurisdictionType = stringValue(entity, 'jurisdictionType');
  const name = stringValue(entity, 'name');
  if (!jurisdictionCode || !countryCode || !jurisdictionType || !name) {
    return null;
  }

  return {
    jurisdictionCode,
    countryCode,
    jurisdictionType,
    name,
    federallyRecognized: booleanValue(entity, 'federallyRecognized'),
    sourceAuthority: stringValue(entity, 'sourceAuthority'),
    sourceNotice: stringValue(entity, 'sourceNotice'),
    sourcePublicationDate: stringValue(entity, 'sourcePublicationDate'),
  };
}

function sortByName<T extends { name: string }>(items: T[]): T[] {
  return items.sort((left, right) => left.name.localeCompare(right.name));
}

export async function GET() {
  const stateTableName =
    process.env.STATE_JURISDICTIONS_TABLE_NAME || DEFAULT_STATE_TABLE_NAME;
  const federalTableName =
    process.env.FEDERAL_JURISDICTIONS_TABLE_NAME || DEFAULT_FEDERAL_TABLE_NAME;
  const tribalTableName =
    process.env.TRIBAL_JURISDICTIONS_TABLE_NAME || DEFAULT_TRIBAL_TABLE_NAME;

  try {
    const [stateEntities, federalEntities, tribalEntities] = await Promise.all([
      listEntities(stateTableName),
      listEntities(federalTableName),
      listEntities(tribalTableName),
    ]);
    const jurisdictions = {
      states: sortByName(
        stateEntities.flatMap((entity) => {
          const jurisdiction = mapStateJurisdiction(entity);
          return jurisdiction ? [jurisdiction] : [];
        }),
      ),
      federal: sortByName(
        federalEntities.flatMap((entity) => {
          const jurisdiction = mapFederalJurisdiction(entity);
          return jurisdiction ? [jurisdiction] : [];
        }),
      ),
      tribal: sortByName(
        tribalEntities.flatMap((entity) => {
          const jurisdiction = mapTribalJurisdiction(entity);
          return jurisdiction ? [jurisdiction] : [];
        }),
      ),
    };
    const parsed = JurisdictionsResponseSchema.safeParse(jurisdictions);
    if (!parsed.success) {
      logger.error('Azure Table jurisdiction data failed validation:', parsed.error);
      return NextResponse.json(
        { error: 'Jurisdiction reference data is invalid.' },
        { status: 500 },
      );
    }

    return NextResponse.json(parsed.data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    logger.error('Failed to load jurisdiction reference data:', error);
    return NextResponse.json(
      { error: 'Failed to load jurisdiction reference data.' },
      { status: 500 },
    );
  }
}
