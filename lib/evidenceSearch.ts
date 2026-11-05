import { z } from 'zod';
import { DocumentTemporalMetadataSchema } from './types.ts';

export const EVIDENCE_FAMILIES = ['claim', 'fact', 'event'] as const;
export const MAX_EVIDENCE_SEARCH_SKIP = 100000;

export const EvidenceFamilySchema = z.enum(EVIDENCE_FAMILIES);
export type EvidenceFamily = z.infer<typeof EvidenceFamilySchema>;

const EvidenceDateFilterSchema = z
  .object({
    from: z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/).optional(),
    to: z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/).optional(),
  })
  .refine((range) => range.from !== undefined || range.to !== undefined);

export const EvidenceExplorerSearchInputSchema = z
  .object({
    families: z.array(EvidenceFamilySchema).min(1).max(3),
    query: z.string().max(1000).default(''),
    tags: z.array(z.string().min(1)).max(100).default([]),
    who: z.array(z.string().min(1)).max(100).default([]),
    where: z.string().optional(),
    whenStarted: EvidenceDateFilterSchema.optional(),
    whenEnded: EvidenceDateFilterSchema.optional(),
    top: z.number().int().min(1).max(1000).default(20),
    skip: z.number().int().min(0).max(MAX_EVIDENCE_SEARCH_SKIP).default(0),
  })
  .strict();

export type EvidenceExplorerSearchInput = z.infer<
  typeof EvidenceExplorerSearchInputSchema
>;

export const EvidenceValuesSchema = z.object({
  accountId: z.string().min(1),
  tags: z.array(z.string()),
  who: z.array(z.string()),
  where: z.array(z.string()),
});

export type EvidenceValues = z.infer<typeof EvidenceValuesSchema>;

const EvidenceDateValueSchema = z
  .union([z.string(), z.record(z.string(), z.unknown())])
  .nullable();

export const EvidenceRecordSchema = z
  .object({
    tags: z.array(z.string()).nullable(),
    who: z.array(z.string()).nullable(),
    whenStarted: EvidenceDateValueSchema,
    whenEnded: EvidenceDateValueSchema,
    asOf: DocumentTemporalMetadataSchema.nullable(),
    what: z.string().nullable(),
    where: z.string().nullable(),
    why: z.string().nullable(),
    sourceId: z.string().nullable(),
    source: z.string().nullable(),
    pages: z.array(z.number().int()).nullable(),
  })
  .strict();

export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;

export const EvidenceSearchResponseSchema = z.object({
  accountId: z.string(),
  query: z.string(),
  tags: z.array(z.string()),
  who: z.array(z.string()).optional(),
  where: z.array(z.string()).optional(),
  whenStarted: EvidenceDateFilterSchema.optional(),
  whenEnded: EvidenceDateFilterSchema.optional(),
  top: z.number().int(),
  skip: z.number().int(),
  totalCount: z.number().int().nullable(),
  results: z.array(EvidenceRecordSchema),
});

export type EvidenceSearchResponse = z.infer<
  typeof EvidenceSearchResponseSchema
>;

export function buildAIMIEEvidenceSearchRequest(
  accountId: string,
  input: EvidenceExplorerSearchInput,
) {
  return {
    accountId,
    query: input.query.trim() || '*',
    tags: [...new Set([...input.families, ...input.tags])],
    ...(input.who.length > 0 ? { who: input.who } : {}),
    ...(input.where ? { where: [input.where] } : {}),
    ...(input.whenStarted ? { whenStarted: input.whenStarted } : {}),
    ...(input.whenEnded ? { whenEnded: input.whenEnded } : {}),
    top: input.top,
    skip: input.skip,
  };
}
