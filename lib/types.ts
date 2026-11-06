import { z } from 'zod';
import { normalizeGraphAttorneyField } from './graphExtension';

export const FeedbackScreenshotSchema = z.object({
  url: z.url(),
  blobName: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  screenshotType: z.string().min(1),
});

export const FeedbackScreenshotsSchema = z.array(FeedbackScreenshotSchema);
export type FeedbackScreenshot = z.infer<typeof FeedbackScreenshotSchema>;
export type FeedbackScreenshots = z.infer<typeof FeedbackScreenshotsSchema>;

/**
 * LLM Usage Output Schema
 * Example:
 * [
 *   {
 *     "accountId": "00000000-0000-4000-8000-000000001102",
 *     "model": "gpt-5.1",
 *     "llmType": "azure-openai-chat",
 *     "inputTokens": 4957394,
 *     "outputTokens": 461068,
 *     "reasoningTokens": 0,
 *     "totalTokens": 5418462,
 *     "origin": "declaration"
 *   },
 *   ...
 * ]
 */
export const LLMUsageEntrySchema = z.object({
  accountId: z.uuid().optional(),
  origin: z.string().optional(),
  model: z.string(),
  llmType: z.string(),
  inputTokens: z
    .number()
    .nullable()
    .optional()
    .transform((value) => value ?? 0),
  outputTokens: z
    .number()
    .nullable()
    .optional()
    .transform((value) => value ?? 0),
  reasoningTokens: z
    .number()
    .nullable()
    .optional()
    .transform((value) => value ?? 0),
  totalTokens: z
    .number()
    .nullable()
    .optional()
    .transform((value) => value ?? 0),
});

export const LLMUsageArraySchema = z.array(LLMUsageEntrySchema);
export type LLMUsageEntry = z.infer<typeof LLMUsageEntrySchema>;
export type LLMUsageArray = z.infer<typeof LLMUsageArraySchema>;

function isValidTimelineDate(value: string): boolean {
  const parts = value.split('-').map(Number);
  const [year, month, day] = parts;
  if (!year || year < 1) {
    return false;
  }
  if (parts.length === 1) {
    return true;
  }
  if (!month || month < 1 || month > 12) {
    return false;
  }
  if (parts.length === 2) {
    return true;
  }
  if (!day || day < 1 || day > 31) {
    return false;
  }
  // Date.UTC treats years 0-99 as offsets from 1900. Set the full year after
  // constructing the date so valid four-digit years such as 0001 remain exact.
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const TimelineDateSchema = z
  .string()
  .regex(/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/)
  .refine(isValidTimelineDate, {
    message: 'Use YYYY, YYYY-MM, or YYYY-MM-DD.',
  });

export const TimelineDateRangeSchema = z
  .object({
    startDate: TimelineDateSchema,
    endDate: TimelineDateSchema.nullish(),
  })
  .transform(({ startDate, endDate }) => ({
    startDate,
    // AIMIE uses null for events with a single known date/period.
    endDate: endDate ?? startDate,
  }))
  .refine((range) => range.startDate <= range.endDate, {
    message: 'The timeline start date must be on or before the end date.',
    path: ['endDate'],
  });

export const TimelineEntryDateRangeSchema = z
  .object({
    startDate: TimelineDateSchema.nullish(),
    endDate: TimelineDateSchema.nullish(),
  })
  .transform(({ startDate, endDate }) => ({
    startDate: startDate ?? null,
    endDate: endDate ?? startDate ?? null,
  }))
  .refine(
    (range) =>
      range.startDate === null ||
      range.endDate === null ||
      range.startDate <= range.endDate,
    {
      message: 'The timeline start date must be on or before the end date.',
      path: ['endDate'],
    },
  );

export const TimelineBuildRequestSchema = z.object({
  sessionId: z.string().min(1),
  input: z.string().trim().min(1).max(10_000),
  maxDocCount: z.number().int().positive().max(10_000).default(1000),
  tags: z.array(z.string().trim().min(1)).min(1).default(['event', 'fact']),
});

export type TimelineBuildRequest = z.infer<typeof TimelineBuildRequestSchema>;

export const TimelineSourceSchema = z.object({
  docId: z.string().min(1),
  sourceId: z.string().min(1),
  url: z.url().refine(
    (value) => {
      try {
        const { protocol } = new URL(value);
        return protocol === 'http:' || protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'Timeline source URL must use HTTP or HTTPS.' },
  ),
  pages: z.array(z.number().int().positive()).default([]),
});

export const TimelineSourceListSchema = z
  .array(z.unknown())
  .nullish()
  .transform((sources) => {
    if (!sources) {
      return [];
    }

    return sources.flatMap((source) => {
      const parsed = TimelineSourceSchema.safeParse(source);
      return parsed.success ? [parsed.data] : [];
    });
  });

export const TimelineEntrySchema = z.object({
  dateRange: TimelineEntryDateRangeSchema.catch({
    startDate: null,
    endDate: null,
  }),
  eventType: z.string().min(1),
  summary: z.string().min(1),
  applicableSources: TimelineSourceListSchema,
});

export const TimelineSchema = z.object({
  sessionId: z.string().min(1),
  accountId: z.string().min(1),
  tags: z.array(z.string().min(1)).default([]),
  summary: z.string().min(1).optional(),
  originalRequest: z.string().min(1),
  timeRange: TimelineDateRangeSchema.optional().catch(undefined),
  entries: z.array(TimelineEntrySchema),
  footnotes: z.array(TimelineEntrySchema).default([]),
  timeToCompletionSeconds: z.number().nonnegative().optional(),
});

export type Timeline = z.infer<typeof TimelineSchema>;

/**
 * Candidates returned after retrieval succeeds but every model review fails.
 * These are intentionally distinct from a verified timeline result.
 */
export const EventQueryPartialResultSchema = TimelineSchema.extend({
  code: z.literal('EVENT_QUERY_PARTIAL_RESULT'),
  message: z.string().min(1),
  retrievalStatus: z.literal('succeeded'),
  reviewStatus: z.literal('incomplete'),
  retrievedRecordCount: z.number().int().nonnegative(),
  retrievedRecords: z.array(z.unknown()),
  failureReasons: z
    .array(
      z.enum([
        'content_filter',
        'model_refusal',
        'invalid_structured_output',
        'timeout',
        'model_error',
        'no_model_variants',
      ]),
    )
    .min(1),
});

export type EventQueryPartialResult = z.infer<
  typeof EventQueryPartialResultSchema
>;

export function isEventQueryPartialResult(
  timeline: Timeline,
): timeline is EventQueryPartialResult {
  return 'code' in timeline && timeline.code === 'EVENT_QUERY_PARTIAL_RESULT';
}

/**
 * Parses a verified or partial direct timeline response, the app's `{ data }`
 * wrapper, or a completed TimelineOrchestration response from the
 * investigative workflow.
 */
export function parseTimelineResult(
  payload: unknown,
): Timeline | EventQueryPartialResult | null {
  const partialResult = EventQueryPartialResultSchema.safeParse(payload);
  if (partialResult.success) {
    return partialResult.data;
  }

  const directResult = TimelineSchema.safeParse(payload);
  if (directResult.success) {
    return directResult.data;
  }

  if (typeof payload === 'string') {
    try {
      return parseTimelineResult(JSON.parse(payload));
    } catch {
      return null;
    }
  }

  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const nestedPayloads = [record.data, record.output, record.body];

  for (const nestedPayload of nestedPayloads) {
    if (nestedPayload === undefined) {
      continue;
    }

    const nestedResult = parseTimelineResult(nestedPayload);
    if (nestedResult) {
      return nestedResult;
    }
  }

  return null;
}

// Metrics schema example:
// [{ name: 'fast-qa', success: true, queryCount: 391, timeToComplete: 61512.48 }, ...]
export const QueryTimingMetricEntrySchema = z.object({
  name: z.string(),
  success: z.boolean(),
  queryCount: z.number().int(),
  timeToComplete: z.number(),
});

export const QueryTimingMetricPivotEntrySchema = z.object({
  name: z.string(),
  successfulQueries: z.number().int(),
  averageSuccessfulQueryTime: z.number(),
  failedQueries: z.number().int(),
  averageFailedQueryTime: z.number(),
  overallAverageQueryTime: z.number(),
});

export const QueryTimingMetricArraySchema = z.array(
  QueryTimingMetricEntrySchema,
);
export type QueryTimingMetricEntry = z.infer<
  typeof QueryTimingMetricEntrySchema
>;
export type QueryTimingMetricArray = z.infer<
  typeof QueryTimingMetricArraySchema
>;

export type QueryTimingMetricPivotEntry = z.infer<
  typeof QueryTimingMetricPivotEntrySchema
>;

export type QueryTimingMetricPivotArray = QueryTimingMetricPivotEntry[];

export function parseQueryTimingMetricArray(
  input: unknown,
): QueryTimingMetricArray {
  return QueryTimingMetricArraySchema.parse(input);
}

export function pivotQueryTimingMetrics(
  metrics: QueryTimingMetricArray,
): QueryTimingMetricPivotArray {
  const pivotMap: Record<string, QueryTimingMetricPivotEntry> = {};
  metrics.forEach((metric) => {
    if (!pivotMap[metric.name]) {
      pivotMap[metric.name] = {
        name: metric.name,
        successfulQueries: 0,
        averageSuccessfulQueryTime: 0,
        failedQueries: 0,
        averageFailedQueryTime: 0,
        overallAverageQueryTime: 0,
      };
    }
    const pivotEntry = pivotMap[metric.name];
    if (metric.success) {
      pivotEntry.successfulQueries += metric.queryCount;
      pivotEntry.averageSuccessfulQueryTime = metric.timeToComplete;
    } else {
      pivotEntry.failedQueries += metric.queryCount;
      pivotEntry.averageFailedQueryTime = metric.timeToComplete;
    }
  });
  // Finalize averages
  Object.values(pivotMap).forEach((entry) => {
    const totalQueries = entry.successfulQueries + entry.failedQueries;
    entry.overallAverageQueryTime =
      totalQueries === 0
        ? 0
        : (entry.successfulQueries * entry.averageSuccessfulQueryTime +
            entry.failedQueries * entry.averageFailedQueryTime) /
          totalQueries;
  });
  return Object.values(pivotMap);
}

export const LLMUsageByOriginAndTypeSchema = z.object({
  locations: z.record(
    z.string(),
    z.object({
      llmTypes: z.record(
        z.string(),
        z.object({
          records: LLMUsageArraySchema,
          totalInputTokens: z.number(),
          totalOutputTokens: z.number(),
          totalReasoningTokens: z.number(),
          overallTotalTokens: z.number(),
        }),
      ),
      totalInputTokens: z.number(),
      totalOutputTokens: z.number(),
      totalReasoningTokens: z.number(),
      overallTotalTokens: z.number(),
    }),
  ),
  grandTotalInputTokens: z.number(),
  grandTotalOutputTokens: z.number(),
  grandTotalReasoningTokens: z.number(),
  overallGrandTotalTokens: z.number(),
});

export type LLMUsageOriginTypesType = z.infer<
  typeof LLMUsageByOriginAndTypeSchema.shape.locations.valueType
>;

export type LLMUsageLLMTypesType = z.infer<
  typeof LLMUsageByOriginAndTypeSchema.shape.locations.valueType.shape.llmTypes.valueType
>;

export type LLMUsageByOriginAndType = z.infer<
  typeof LLMUsageByOriginAndTypeSchema
>;

export function parseLLMUsageArray(input: unknown): LLMUsageArray {
  return LLMUsageArraySchema.parse(input);
}

export function parseLLMUsageEntry(input: unknown): LLMUsageByOriginAndType {
  return LLMUsageByOriginAndTypeSchema.parse(input);
}

export const OverallStatsSchema = z.object({
  llmStats: LLMUsageByOriginAndTypeSchema,
  queryTimingMetrics: QueryTimingMetricArraySchema,
});

export type OverallStats = z.infer<typeof OverallStatsSchema>;

export function parseOverallStats(input: unknown): OverallStats {
  return OverallStatsSchema.parse(input);
}

export function groupLLMUsageByOriginAndType(
  usages: LLMUsageArray,
  queryStats: QueryTimingMetricArray,
): OverallStats {
  const result: LLMUsageByOriginAndType = {
    locations: {},
    grandTotalInputTokens: 0,
    grandTotalOutputTokens: 0,
    grandTotalReasoningTokens: 0,
    overallGrandTotalTokens: 0,
  };
  const resultSet = result.locations;
  usages.forEach((usage) => {
    const origin = usage.origin || 'unknown';
    if (!resultSet[origin]) {
      resultSet[origin] = {
        llmTypes: {},
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalReasoningTokens: 0,
        overallTotalTokens: 0,
      };
    }

    if (!resultSet[origin].llmTypes[usage.llmType]) {
      resultSet[origin].llmTypes[usage.llmType] = {
        records: [],
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalReasoningTokens: 0,
        overallTotalTokens: 0,
      };
    }
    const originRecord = resultSet[origin];
    originRecord.totalInputTokens += usage.inputTokens;
    originRecord.totalOutputTokens += usage.outputTokens;
    originRecord.totalReasoningTokens += usage.reasoningTokens;
    originRecord.overallTotalTokens += usage.totalTokens;
    const llmTypeRecord = originRecord.llmTypes[usage.llmType];
    llmTypeRecord.records.push(usage);
    llmTypeRecord.totalInputTokens += usage.inputTokens;
    llmTypeRecord.totalOutputTokens += usage.outputTokens;
    llmTypeRecord.totalReasoningTokens += usage.reasoningTokens;
    llmTypeRecord.overallTotalTokens += usage.totalTokens;
    result.grandTotalInputTokens += usage.inputTokens;
    result.grandTotalOutputTokens += usage.outputTokens;
    result.grandTotalReasoningTokens += usage.reasoningTokens;
    result.overallGrandTotalTokens += usage.totalTokens;
  });
  return { llmStats: result, queryTimingMetrics: queryStats };
}

/*
LLM Detail Schema
Example:
{
accountId: "00000000-0000-4000-8000-000000001102",
billingCode: "S1",
llmUsageDetails:
[
{
    "id": "2026-01-15T03:35:48.559902Z_00000000-0000-4000-8000-000000001102_00000000-0000-4000-8000-000000001103",
    "sessionId": "00000000-0000-4000-8000-000000001103",
    "usageTs": "2026-01-15T03:35:48.559902Z",
    "origin": "AIMIE",
    "model": "gpt-5.1",
    "llmType": "azure-openai-chat",
    "inputTokens": 22802,
    "outputTokens": 5490,
    "totalTokens": 28292,
    "reasoningTokens": 126,
    "isSecondaryLLM": false
}
]}
*/

export const LLMUsageDetailsEntrySchema = z.object({
  id: z.string(),
  sessionId: z.uuid(),
  usageTs: z.iso.datetime().transform((x) => {
    return x ? new Date(x) : undefined;
  }),
  origin: z.string().optional(),
  model: z.string(),
  llmType: z.string(),
  inputTokens: z
    .number()
    .optional()
    .nullable()
    .transform((value) => value ?? 0),
  outputTokens: z
    .number()
    .optional()
    .nullable()
    .transform((value) => value ?? 0),
  reasoningTokens: z
    .number()
    .optional()
    .nullable()
    .transform((value) => value ?? 0),
  totalTokens: z
    .number()
    .optional()
    .nullable()
    .transform((value) => value ?? 0),
  isSecondaryLLM: z.boolean().optional(),
});

export const LLMUsageDetailsEntryArraySchema = z.array(
  LLMUsageDetailsEntrySchema,
);

export const BillingCodeSchema = z.enum(['F', 'S1', 'G1', 'D']);
export type BillingCode = z.infer<typeof BillingCodeSchema>;

export const LLMUsageDetailEntriesSchema = z.object({
  accountId: z.uuid(),
  billingCode: BillingCodeSchema.optional(),
  llmUsageDetails: LLMUsageDetailsEntryArraySchema,
});

export type LLMUsageDetailsEntry = z.infer<typeof LLMUsageDetailsEntrySchema>;
export type LLMUsageDetailEntries = z.infer<typeof LLMUsageDetailEntriesSchema>;

export class LLMUsageDetailEntriesModel {
  static readonly schema = LLMUsageDetailEntriesSchema;
  readonly data: LLMUsageDetailEntries;

  constructor(data: LLMUsageDetailEntries) {
    this.data = data;
  }
  static parse(input: unknown) {
    return new LLMUsageDetailEntriesModel(this.schema.parse(input));
  }

  static parseFromEntryArray(
    accountId: string,
    billingCode: BillingCode | undefined,
    entries: unknown,
  ) {
    return new LLMUsageDetailEntriesModel({
      accountId,
      billingCode,
      llmUsageDetails: LLMUsageDetailsEntryArraySchema.parse(entries),
    });
  }
}

/* ───────────────────────── Sub-schemas ───────────────────────── */

const StateCode = z
  .string()
  .regex(/^[A-Z]{2}$/, 'Expected 2-letter state code');
const EmailOptional = z.union([z.email(), z.literal('')]).optional(); // accepts "" in your sample
const PhoneOptional = z.string().optional(); // keep free-form; tighten if you have a format

export const PersonInformationSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  organization: z.string().optional(),
  middleInitial: z.string().optional(),
  emailAddress: EmailOptional,
  phoneNumber: PhoneOptional,
});

export const AttorneySchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  firmName: z.string(),
  emailAddress: EmailOptional,
  phoneNumber: PhoneOptional,
  isCurrent: z.boolean(),
});

export const OppositionSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  organization: z.string().optional(),
  filingRole: z.string(), // e.g., "Petitioner"
  emailAddress: EmailOptional,
  phoneNumber: PhoneOptional,
  attorneyInformation: z.array(AttorneySchema).optional(),
  currentAttorney: AttorneySchema.optional(), // not present in sample; keep optional
});

/* ───────────────────────── Main entity ───────────────────────── */

export const OriginalCaseDetailsSchema = z.object({
  id: z.uuid().optional(),
  accountId: z.uuid().optional(),
  type: z.literal('ACCOUNT_DETAILS'), // tighten to the observed value; widen later if needed
  caseNumber: z.string(), // may be "", so leave as plain string
  personInformation: PersonInformationSchema,
  filingRole: z.string(), // e.g., "Respondent"
  state: StateCode, // "WA"
  county: z.string(),
  description: z.string(),
  attorneyInformation: z.array(AttorneySchema).optional(),
  opposition: OppositionSchema,
  nickname: z.string().optional(), // not present in sample; keep optional
  dataSourceId: z.string().optional(), // looks like a hex hash; keep as string
  ingestionServiceAccount: z.email().optional(), // not present in sample; keep optional
  secretname: z.string().optional(), // base64-ish string; keep as string
  searchEndpoint: z.string().optional(), // URL string; keep as string for now
  currentAttorney: AttorneySchema.optional(), // not present in sample; keep optional
  isSharedResource: z.boolean().optional(), // not present in sample; keep optional
  extendedControls: z
    .object({
      verbosity: z.boolean().optional().default(false),
      swapRoles: z.boolean().optional().default(false),
    })
    .optional(),
});

export const OriginalCaseDetailsSchemaRequest =
  OriginalCaseDetailsSchema.extend({
    isAttorney: z.boolean(),
    billingCode: BillingCodeSchema.optional(),
    oid: z.string().optional(),
  });

/** Root = array of case records */
export const OriginalCaseRecordsSchema = z.array(OriginalCaseDetailsSchema);

/* ─────────────────────────── Types ───────────────────────────── */

export type PersonInformation = z.infer<typeof PersonInformationSchema>;
export type Attorney = z.infer<typeof AttorneySchema>;
export type Opposition = z.infer<typeof OppositionSchema>;
export type OriginalCaseRecord = z.infer<typeof OriginalCaseDetailsSchema>;
export type OriginalCaseRecords = z.infer<typeof OriginalCaseRecordsSchema>;
export type OriginalCaseRecordRequest = z.infer<
  typeof OriginalCaseDetailsSchemaRequest
>;

export function parseOriginalCaseRecordRequest(
  input: unknown,
): OriginalCaseRecordRequest {
  return OriginalCaseDetailsSchemaRequest.parse(input);
}

// ──────────────── QA Interaction Zod Schema ────────────────
export const DocumentTemporalMetadataSchema = z.object({
  year: z.string().optional().nullable(),
  month: z.string().optional().nullable(),
  day: z.string().optional().nullable(),
  season: z.string().optional().nullable(),
  quarter: z.string().optional().nullable(),
});

export type DocumentTemporalMetadata = z.infer<
  typeof DocumentTemporalMetadataSchema
>;

const DocumentStructuredMetadataTextSchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .nullable();

const DocumentStructuredMetadataShape = {
  tags: z.array(z.string()).optional().nullable(),
  who: DocumentStructuredMetadataTextSchema,
  what: DocumentStructuredMetadataTextSchema,
  where: DocumentStructuredMetadataTextSchema,
  why: DocumentStructuredMetadataTextSchema,
  whenStarted: DocumentTemporalMetadataSchema.optional().nullable(),
  whenEnded: DocumentTemporalMetadataSchema.optional().nullable(),
};

export const DocumentSchema = z.object({
  docId: z.string(),
  sourceUrl: z.url(),
  headers: z.array(z.string()),
  pages: z.array(z.number()),
  position: z.number(),
  sourceId: z.string(),
  pageContent: z.string(),
  ...DocumentStructuredMetadataShape,
});

export type Document = z.infer<typeof DocumentSchema>;

export const SlimDocumentSchema = z.object({
  docId: z.string(),
  sourceUrl: z.url(),
  pages: z.array(z.number()),
  ...DocumentStructuredMetadataShape,
});

export type SlimDocument = z.infer<typeof SlimDocumentSchema>;

export const QAExhibitSchema = z.object({
  doc: z.union([DocumentSchema, SlimDocumentSchema]),
  firstIndex: z.number(),
});

export const ContextSchema = z.object({
  docId: z.string(),
  sourceUrl: z.url(),
  headers: z.array(z.string()),
  pages: z.array(z.number()),
  position: z.number().optional(),
  sourceId: z.string().optional(),
  pageContent: z.string(),
});

export const QAInteractionSchema = z.object({
  accountId: z.uuid().optional(),
  document: z.string(),
  exhibits: z.array(QAExhibitSchema),
  context: z.array(ContextSchema),
});

export const QAInteractionSlimSchema = z.object({
  accountId: z.uuid().optional(),
  document: z.string(),
  exhibits: z.array(QAExhibitSchema),
});

export type QAInteraction = z.infer<typeof QAInteractionSchema>;
export type QAInteractionSlim = z.infer<typeof QAInteractionSlimSchema>;

// Converts raw input to QAInteraction
export function parseQAInteraction(input: unknown): QAInteraction {
  return QAInteractionSchema.parse(input);
}

// Converts DocumentSchema  to SlimDocumentSchema
export function convertToSlimDocument(
  doc: Document | SlimDocument,
): SlimDocument {
  return {
    docId: doc.docId,
    sourceUrl: doc.sourceUrl,
    pages: doc.pages,
    tags: doc.tags,
    who: doc.who,
    what: doc.what,
    where: doc.where,
    why: doc.why,
    whenStarted: doc.whenStarted,
    whenEnded: doc.whenEnded,
  };
}

export class QAInteractionSlimModel {
  static readonly schema = QAInteractionSlimSchema;
  readonly data: QAInteractionSlim;

  constructor(data: QAInteractionSlim) {
    this.data = data;
    this.data.exhibits = this.data.exhibits.map((exhibit) => {
      const newDoc = convertToSlimDocument(exhibit.doc);
      return {
        ...exhibit,
        doc: newDoc,
      };
    });
  }
  static parse(input: unknown) {
    return new QAInteractionSlimModel(this.schema.parse(input));
  }
}

/* ───────────── Optional: OO-style wrappers over Zod ──────────── */

export class CaseDetailModel {
  static readonly schema = OriginalCaseDetailsSchema;
  readonly data: OriginalCaseRecord;

  constructor(data: OriginalCaseRecord) {
    this.data = data;
  }
  static parse(input: unknown) {
    return new CaseDetailModel(this.schema.parse(input));
  }
}

export class OriginalCaseDetailsModel {
  static readonly schema = OriginalCaseRecordsSchema;
  readonly items: OriginalCaseRecord[];

  constructor(items: OriginalCaseRecord[]) {
    this.items = items;
  }
  static parse(input: unknown) {
    return new OriginalCaseDetailsModel(this.schema.parse(input));
  }
}

const CaseAccountDateSchema = z
  .union([z.iso.datetime(), z.date()])
  .transform((value) => (value instanceof Date ? value : new Date(value)));

export const CaseAccountSchema = z.object({
  accountId: z.uuid(),
  caseNumber: z.string(), // e.g., "TBD:2025-03-04T23:17:30.2961113Z" or "YXXY-ZY-234A"
  billingCode: BillingCodeSchema.optional(),
  termsBillingCode: BillingCodeSchema.optional(),
  agreedToCaseTerms: z.boolean().default(false),
  isGuest: z.boolean().optional(),
  isActive: z.boolean().optional(),
  expiry: CaseAccountDateSchema.optional(),
  canGenerateDeclaration: z.boolean().optional(),
  canUseQA: z.boolean().optional(),
  canAccessDocuments: z.boolean().optional(),
  documentAccessRole: z.enum(['CONTRIBUTOR', 'VIEW-ONLY']).optional(),
  requestDate: CaseAccountDateSchema.optional(),
  record: OriginalCaseDetailsSchema.optional(), // full case details; optional here
  llmUsage: LLMUsageArraySchema.optional(), // optional LLM usage data
});

export const OfferedDemoSchema = z.object({
  acceptedOffer: z.boolean(),
  nextOffer: z.iso.datetime().optional(),
  lastOffer: z.iso.datetime().optional(),
});

/** A professional admission held by an attorney account. */
export const FederalCourtTypeSchema = z.enum([
  'DistrictCourt',
  'CourtOfAppeals',
  'SupremeCourt',
  'BankruptcyCourt',
  'CourtOfInternationalTrade',
  'CourtOfFederalClaims',
  'TaxCourt',
  'VeteransClaimsCourt',
  'ArmedForcesCourt',
  'BankruptcyAppellatePanel',
]);

export const BarAdmissionSchema = z
  .object({
    jurisdictionType: z.enum(['State', 'Federal', 'Tribal']),
    jurisdictionCode: z.string().trim().min(1),
    identifier: z.string().trim().min(1),
    courtType: FederalCourtTypeSchema.optional(),
  })
  .superRefine((admission, context) => {
    if (
      admission.jurisdictionType === 'Federal' &&
      admission.courtType === undefined
    ) {
      context.addIssue({
        code: 'custom',
        path: ['courtType'],
        message: 'Federal bar admissions require a court type.',
      });
    }

    if (
      admission.jurisdictionType !== 'Federal' &&
      admission.courtType !== undefined
    ) {
      context.addIssue({
        code: 'custom',
        path: ['courtType'],
        message: 'Court type applies only to Federal bar admissions.',
      });
    }
  });

export const BarAdmissionsSchema = z.array(BarAdmissionSchema);
export const BarAdmissionsResponseSchema = z.object({
  barAdmissions: BarAdmissionsSchema,
});

export const StateJurisdictionSchema = z.object({
  jurisdictionCode: z.string().trim().min(1),
  countryCode: z.string().trim().min(1),
  name: z.string().trim().min(1),
  type: z.string().trim().min(1),
});

export const FederalJurisdictionSchema = z.object({
  jurisdictionCode: z.string().trim().min(1),
  countryCode: z.string().trim().min(1),
  courtType: FederalCourtTypeSchema,
  jurisdictionType: z.string().trim().min(1),
  name: z.string().trim().min(1),
  stateCode: z.string().trim().min(1).optional(),
  circuitCode: z.string().trim().min(1).optional(),
  parentDistrictCode: z.string().trim().min(1).optional(),
  parentDistrictCodes: z.string().trim().min(1).optional(),
  nationwide: z.boolean().nullable().optional(),
});

export const TribalJurisdictionSchema = z.object({
  jurisdictionCode: z.string().trim().min(1),
  countryCode: z.string().trim().min(1),
  federallyRecognized: z.boolean().optional(),
  jurisdictionType: z.string().trim().min(1),
  name: z.string().trim().min(1),
  sourceAuthority: z.string().trim().min(1).optional(),
  sourceNotice: z.string().trim().min(1).optional(),
  sourcePublicationDate: z.string().trim().min(1).optional(),
});

export const JurisdictionsResponseSchema = z.object({
  states: z.array(StateJurisdictionSchema),
  federal: z.array(FederalJurisdictionSchema),
  tribal: z.array(TribalJurisdictionSchema),
});

const UserAccountBaseSchema = z.object({
  id: z.uuid().optional(),
  emailAddresses: z.array(z.email()).default([]),
  oids: z.array(z.uuid()).default([]),
  casesAccounts: z.array(CaseAccountSchema).default([]),
  type: z.string().optional(), // e.g. SHARED_RESOURCES
  accountId: z.uuid().optional(),
  agreedToTerms: z.boolean().default(false),
  isActive: z.boolean().default(false),
  offeredDemo: OfferedDemoSchema.nullish().transform(
    (value) => value ?? undefined,
  ),
});

// Account data returned from general account and case endpoints. Sensitive
// profile-only fields belong in the stored schema below, not this projection.
export const UserAccountSchema = UserAccountBaseSchema;

// Internal Cosmos document schema. Use this only where a full document must be
// preserved for storage; do not return it from a general account endpoint.
export const StoredUserAccountSchema = UserAccountBaseSchema.extend({
  // Present only for attorney accounts; omit it for non-attorney accounts.
  barAdmissions: BarAdmissionsSchema.optional(),
});

// The root JSON is an array of user accounts
export const UserAccountsSchema = z.array(UserAccountSchema);
export const StoredUserAccountsSchema = z.array(StoredUserAccountSchema);

/** ── Types (inferred from Zod) ─────────────────────────────────────────── */

export type CaseMap = z.infer<typeof CaseAccountSchema>;
export type OfferedDemo = z.infer<typeof OfferedDemoSchema>;
export type FederalCourtType = z.infer<typeof FederalCourtTypeSchema>;
export type BarAdmission = z.infer<typeof BarAdmissionSchema>;
export type StateJurisdiction = z.infer<typeof StateJurisdictionSchema>;
export type FederalJurisdiction = z.infer<typeof FederalJurisdictionSchema>;
export type TribalJurisdiction = z.infer<typeof TribalJurisdictionSchema>;
export type JurisdictionsResponse = z.infer<
  typeof JurisdictionsResponseSchema
>;
export type UserAccount = z.infer<typeof UserAccountSchema>;
export type UserAccounts = z.infer<typeof UserAccountsSchema>;
export type StoredUserAccount = z.infer<typeof StoredUserAccountSchema>;
export type StoredUserAccounts = z.infer<typeof StoredUserAccountsSchema>;

type CaseAccountVisibilityState = {
  isActive?: boolean;
  expiry?: Date | string | null;
};

export function isCaseAccountVisible(
  caseAccount: CaseAccountVisibilityState,
  now: Date = new Date(),
): boolean {
  if (caseAccount.isActive === false) {
    return false;
  }

  if (!caseAccount.expiry) {
    return true;
  }

  const expiry =
    caseAccount.expiry instanceof Date
      ? caseAccount.expiry
      : new Date(caseAccount.expiry);
  if (Number.isNaN(expiry.getTime())) {
    return false;
  }

  return now.getTime() <= expiry.getTime();
}

/** ── Optional: “classes” that wrap Zod for ergonomics ──────────────────── */

export class CaseMapModel {
  static readonly schema = CaseAccountSchema;
  accountId: string;
  caseNumber: string;
  record?: OriginalCaseRecord;
  llmUsage?: LLMUsageArray;
  isActive?: boolean;
  expiry?: Date;
  billingCode?: BillingCode;
  termsBillingCode?: BillingCode;
  agreedToCaseTerms: boolean;

  private constructor(data: CaseMap) {
    this.accountId = data.accountId;
    this.caseNumber = data.caseNumber;
    this.record = data.record;
    this.llmUsage = data.llmUsage;
    this.isActive = data.isActive;
    this.expiry = data.expiry;
    this.billingCode = data.billingCode;
    this.termsBillingCode = data.termsBillingCode;
    this.agreedToCaseTerms = data.agreedToCaseTerms;
  }

  static parse(input: unknown) {
    return new CaseMapModel(this.schema.parse(input));
  }

  static parseMany(input: unknown) {
    const arr = CaseAccountSchema.array().parse(input);
    return arr.map((c) => new CaseMapModel(c));
  }
}

export class UserAccountModel {
  static readonly schema = UserAccountSchema;
  type: string | undefined;
  id: string | undefined;
  emailAddresses: string[];
  oids: string[];
  casesAccounts: CaseMap[];
  accountId: string | undefined;
  agreedToTerms: boolean;
  isActive: boolean;
  offeredDemo: OfferedDemo | undefined;

  private constructor(data: UserAccount) {
    this.type = data.type;
    this.id = data.id;
    this.emailAddresses = data.emailAddresses;
    this.oids = data.oids;
    this.casesAccounts = data.casesAccounts;
    this.accountId = data.accountId;
    this.agreedToTerms = data.agreedToTerms;
    this.isActive = data.isActive;
    this.offeredDemo = data.offeredDemo;
  }

  static parse(input: unknown) {
    return new UserAccountModel(this.schema.parse(input));
  }

  static withCaseTermsAccepted(
    current: UserAccountModel,
    caseId: string,
  ): UserAccountModel {
    return new UserAccountModel({
      type: current.type,
      id: current.id,
      emailAddresses: current.emailAddresses,
      oids: current.oids,
      accountId: current.accountId,
      agreedToTerms: current.agreedToTerms,
      isActive: current.isActive,
      offeredDemo: current.offeredDemo,
      casesAccounts: current.casesAccounts.map((caseAccount) =>
        caseAccount.accountId === caseId
          ? { ...caseAccount, agreedToCaseTerms: true }
          : caseAccount,
      ),
    });
  }

  /** Parse an array of user accounts */
  static parseMany(input: unknown) {
    const arr = UserAccountsSchema.parse(input);
    return arr.map((c) => new UserAccountModel(c));
  }
}

export const CaseAccountGroupSchema = z.array(
  z.object({
    caseAccount: CaseAccountSchema,
  }),
);

/** ────────── QA classes ──────────── */
export const QACommentSchema = z.object({
  sessionId: z.string(),
  input: z.string(),
  maxDocCount: z.number().min(1).max(500).default(120), // default to 120 to ensure a wide range of document segments are used
  provideThoroughResponse: z.boolean().default(false),
  accountId: z.string().optional(), // not present in sample; keep optional
  verbosityLevel: z.enum(['low', 'medium', 'high']).optional(),
  swapRoles: z.boolean().optional(),
});

export type QAComment = z.infer<typeof QACommentSchema>;

export class QACommentModel {
  static readonly schema = QACommentSchema;
  sessionId: string;
  input: string;
  maxDocCount: number;
  provideThoroughResponse: boolean;
  accountId?: string;
  verbosityLevel?: 'low' | 'medium' | 'high';
  swapRoles?: boolean;

  private constructor(data: QAComment) {
    this.sessionId = data.sessionId;
    this.input = data.input;
    this.maxDocCount = data.maxDocCount;
    this.provideThoroughResponse = data.provideThoroughResponse;
    this.accountId = data.accountId;
    this.verbosityLevel = data.verbosityLevel;
    this.swapRoles = data.swapRoles;
  }

  static parse(input: unknown) {
    return new QACommentModel(this.schema.parse(input));
  }
}

// Using Zod, create a set of types used to represent the data structure of SharePoint documents
const DeferredSchema = z.object({
  __deferred: z.object({
    uri: z.string(),
  }),
});

// Metadata schema
const MetadataSchema = z.object({
  id: z.string(),
  uri: z.string(),
  type: z.string(),
  etag: z.string().optional(),
});

// List Item All Fields schema
const ListItemAllFieldsSchema = z.object({
  __metadata: MetadataSchema,
  FirstUniqueAncestorSecurableObject: DeferredSchema.optional(),
  RoleAssignments: DeferredSchema.optional(),
  AttachmentFiles: DeferredSchema.optional(),
  ContentType: DeferredSchema.optional(),
  GetDlpPolicyTip: DeferredSchema.optional(),
  FieldValuesAsHtml: DeferredSchema.optional(),
  FieldValuesAsText: DeferredSchema.optional(),
  FieldValuesForEdit: DeferredSchema.optional(),
  File: z.any().optional(),
  Folder: DeferredSchema.optional(),
  LikedByInformation: DeferredSchema.optional(),
  ParentList: DeferredSchema.optional(),
  Properties: z.any().nullable().optional(),
  Versions: DeferredSchema.optional(),
  FileSystemObjectType: z.number(),
  Id: z.number(),
  ServerRedirectedEmbedUri: z.string().nullable(),
  ServerRedirectedEmbedUrl: z.string(),
  ContentTypeId: z.string(),
  OData__ColorTag: z.string().nullable(),
  ComplianceAssetId: z.string().nullable(),
  Title: z.string().nullable(),
  ID: z.number(),
  Created: z.string(),
  AuthorId: z.number(),
  Modified: z.string(),
  EditorId: z.number(),
  OData__CopySource: z.string().nullable(),
  CheckoutUserId: z.number().nullable(),
  OData__UIVersionString: z.string(),
  GUID: z.string(),
});

// File schema
const FileSchema = z.object({
  __metadata: MetadataSchema,
  Author: DeferredSchema.optional(),
  CheckedOutByUser: DeferredSchema.optional(),
  EffectiveInformationRightsManagementSettings: DeferredSchema.optional(),
  InformationRightsManagementSettings: DeferredSchema.optional(),
  ListItemAllFields: ListItemAllFieldsSchema,
  LockedByUser: DeferredSchema.optional(),
  ModifiedBy: DeferredSchema.optional(),
  Properties: z.any().nullable().optional(),
  VersionEvents: DeferredSchema.optional(),
  VersionExpirationReport: DeferredSchema.optional(),
  Versions: DeferredSchema.optional(),
  Web: DeferredSchema.optional(),
  CheckInComment: z.string(),
  CheckOutType: z.number(),
  ContentTag: z.string(),
  CustomizedPageStatus: z.number(),
  ETag: z.string(),
  Exists: z.boolean(),
  ExistsAllowThrowForPolicyFailures: z.boolean(),
  ExistsWithException: z.boolean(),
  IrmEnabled: z.boolean(),
  Length: z.string(),
  Level: z.number(),
  LinkingUri: z.string().nullable(),
  LinkingUrl: z.string(),
  MajorVersion: z.number(),
  MinorVersion: z.number(),
  Name: z.string(),
  ServerRelativeUrl: z.string(),
  TimeCreated: z.coerce.date(),
  TimeLastModified: z.string(),
  Title: z.string().nullable(),
  UIVersion: z.number(),
  UIVersionLabel: z.string(),
  UniqueId: z.string(),
  Content: z.string().optional(), // base64-encoded content, optional
});

// Folder schema
const FolderSchema = z.object({
  __metadata: MetadataSchema,
  Files: DeferredSchema.optional(),
  ListItemAllFields: z
    .union([ListItemAllFieldsSchema, DeferredSchema])
    .optional(),
  ParentFolder: DeferredSchema.optional(),
  Properties: z.any().nullable().optional(),
  StorageMetrics: DeferredSchema.optional(),
  Folders: DeferredSchema.optional(),
  Exists: z.boolean(),
  ExistsAllowThrowForPolicyFailures: z.boolean(),
  ExistsWithException: z.boolean(),
  IsWOPIEnabled: z.boolean(),
  ItemCount: z.number(),
  Name: z.string(),
  ProgID: z.string().nullable(),
  ServerRelativeUrl: z.string(),
  TimeCreated: z.string(),
  TimeLastModified: z.string(),
  UniqueId: z.string(),
  WelcomePage: z.string(),
});

// Full response schema with expanded Files and Folders
const SharePointDocumentAccessSchema = z.object({
  role: z.enum(['CONTRIBUTOR', 'VIEW-ONLY']),
  canCreateFolders: z.boolean(),
  canRenameFolders: z.boolean(),
  canDeleteFolders: z.boolean(),
  canUploadFiles: z.boolean(),
  canDeleteFiles: z.boolean(),
});

const SharePointFolderResponseSchema = z.object({
  d: z.object({
    __metadata: MetadataSchema,
    Files: z.object({
      results: z.array(FileSchema),
    }),
    ListItemAllFields: DeferredSchema.optional(),
    ParentFolder: DeferredSchema.optional(),
    Properties: z.any().nullable().optional(),
    StorageMetrics: DeferredSchema.optional(),
    Folders: z.object({
      results: z.array(FolderSchema),
    }),
    Exists: z.boolean(),
    ExistsAllowThrowForPolicyFailures: z.boolean(),
    ExistsWithException: z.boolean(),
    IsWOPIEnabled: z.boolean(),
    ItemCount: z.number(),
    Name: z.string(),
    ProgID: z.string().nullable(),
    ServerRelativeUrl: z.string(),
    TimeCreated: z.string(),
    TimeLastModified: z.string(),
    UniqueId: z.string(),
    WelcomePage: z.string(),
  }),
  baseUrl: z.string().optional(), // optional, not always present
  documentAccessRole: z.enum(['CONTRIBUTOR', 'VIEW-ONLY']).optional(),
  documentAccess: SharePointDocumentAccessSchema.optional(),
});

const SharePointFileResponseSchema = z.object({
  d: FileSchema,
  baseUrl: z.string().optional(), // optional, not always present
  content: z.base64().optional(), // base64-encoded content, optional
});

// Export types inferred from schemas
export type SharePointDeferred = z.infer<typeof DeferredSchema>;
export type SharePointMetadata = z.infer<typeof MetadataSchema>;
export type SharePointListItemAllFields = z.infer<
  typeof ListItemAllFieldsSchema
>;
export type SharePointFile = z.infer<typeof FileSchema>;
export type SharePointFolder = z.infer<typeof FolderSchema>;
export type SharePointFolderResponse = z.infer<
  typeof SharePointFolderResponseSchema
>;
export type SharePointFileResponse = z.infer<
  typeof SharePointFileResponseSchema
>;

// Export schemas
export {
  DeferredSchema,
  FileSchema,
  FolderSchema,
  ListItemAllFieldsSchema,
  MetadataSchema,
  SharePointFolderResponseSchema,
};

// Helper function to parse and validate response
export function parseSharePointResponse(
  data: unknown,
): SharePointFolderResponse {
  return SharePointFolderResponseSchema.parse(data);
}

export function parseSharePointFileResponse(
  data: unknown,
): SharePointFileResponse {
  return SharePointFileResponseSchema.parse(data);
}

// Helper function to extract file IDs
export function extractFileIds(response: SharePointFolderResponse) {
  return response.d.Files.results.map((file) => ({
    name: file.Name,
    uniqueId: file.UniqueId,
    listItemId: file.ListItemAllFields.ID,
    serverRelativeUrl: file.ServerRelativeUrl,
  }));
}

// Helper function to extract folder IDs
export function extractFolderIds(response: SharePointFolderResponse) {
  return response.d.Folders.results.map((folder) => ({
    name: folder.Name,
    uniqueId: folder.UniqueId,
    listItemId:
      typeof folder.ListItemAllFields !== 'object' ||
      '__deferred' in folder.ListItemAllFields
        ? null
        : folder.ListItemAllFields.ID,
    serverRelativeUrl: folder.ServerRelativeUrl,
  }));
}

/** Enum for the discriminator */
const NOTIFICATION_TYPE_VALUES = [
  'DECLARATION',
  'ARGUMENT_BUILDER',
  'CHAT_MESSAGE',
  'ALERT',
  'INGESTION',
  'EGESTION',
  'CASE_CREATED',
  'CASE_DELETED',
  'TIMELINE_BUILDER',
] as const;

const WORKFLOW_STATUS_VALUES = [
  'STARTED',
  'SUCCESS',
  'FAILED',
] as const;
const ARGUMENT_STATUS_VALUES = [
  'STARTED',
  'INITIAL_ARGUMENT',
  'COUNTER_ARGUMENT',
  'FINAL_ARGUMENT',
  'FACT_VALIDATION',
  'REVISION',
  'SUCCESS',
  'FAILED',
] as const;
const INGESTION_STATUS_VALUES = [
  'STARTED',
  'SUCCESS',
  'FAILED',
  'PRELIMINARY',
  'EVIDENCE_EXTRACTION',
] as const;

export const NotificationTypeSchema = z.enum(NOTIFICATION_TYPE_VALUES);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

/** Exhibit */
export const ExhibitSchema = z
  .object({
    // coerce allows "3" -> 3 while still requiring an integer >= 0
    index: z.coerce.number().int().nonnegative(),
    docId: z.string().min(1, 'docId is required'),
    name: z.string().min(1).optional(),
    sourceUrl: z.url('sourceUrl must be a valid URL'),
  })
  .strict();
export type Exhibit = z.infer<typeof ExhibitSchema>;

/** Base notice (no data payload) */
export const GeneralNoticeSchema = z.object({
  oid: z.string().min(1, 'oid is required'),
  notificationType: NotificationTypeSchema,
  id: z.string().min(5, 'id is required'),
  read: z.boolean().optional().default(false),
  deleted: z.boolean().optional().default(false),
  createdAt: z.iso
    .datetime()
    .optional()
    .transform((x) => (x ? new Date(x) : undefined)),
  readAt: z.iso
    .datetime()
    .optional()
    .transform((x) => (x ? new Date(x) : undefined)),
});
export type GeneralNotice = z.infer<typeof GeneralNoticeSchema>;

/** DeclarationNotice extends GeneralNotice with a fixed discriminator and data */
export const DeclarationNoticeSchema = GeneralNoticeSchema.extend({
  notificationType: z.literal('DECLARATION'),
  data: z
    .object({
      requestText: z.string().optional(),
      requestId: z.string().optional(),
      accountId: z.string().min(1, 'accountId is required'),
      sessionId: z.string().min(1, 'sessionId is required'),
      declarationUrl: z
        .url('declarationUrl must be a valid URL')
        .nullable()
        .optional(),
      status: z.enum(WORKFLOW_STATUS_VALUES),
      errorMessage: z.string().optional(),
    })
    .strict(),
});
export type DeclarationNotice = z.infer<typeof DeclarationNoticeSchema>;

export const ArgumentBuilderNoticeSchema = GeneralNoticeSchema.extend({
  notificationType: z.literal('ARGUMENT_BUILDER'),
  data: z
    .object({
      requestText: z.string().optional(),
      requestId: z.string().optional(),
      accountId: z.string().min(1, 'accountId is required'),
      sessionId: z.string().min(1, 'sessionId is required'),
      declarationUrl: z
        .url('declarationUrl must be a valid URL')
        .nullable()
        .optional(),
      status: z.enum(ARGUMENT_STATUS_VALUES),
      errorMessage: z.string().optional(),
    })
    .strict(),
});
export type ArgumentBuilderNotice = z.infer<typeof ArgumentBuilderNoticeSchema>;

export const DocumentIngestionNoticeSchema = GeneralNoticeSchema.extend({
  notificationType: z.literal('INGESTION'),
  data: z
    .object({
      accountId: z.string().min(1, 'accountId is required'),
      status: z.enum(INGESTION_STATUS_VALUES),
      errorMessage: z.string().optional(),
      filepath: z.string().min(1, 'filepath is required'),
    })
    .strict(),
});
export type DocumentIngestionNotice = z.infer<
  typeof DocumentIngestionNoticeSchema
>;

export const TimelineBuilderNoticeSchema = GeneralNoticeSchema.extend({
  notificationType: z.literal('TIMELINE_BUILDER'),
  data: z
    .object({
      requestText: z.string().optional(),
      accountId: z.string().min(1, 'accountId is required'),
      sessionId: z.string().min(1, 'sessionId is required'),
      status: z.enum(WORKFLOW_STATUS_VALUES),
      errorMessage: z.string().optional(),
      requestId: z.string().optional(),
    })
    .strict(),
}).strict();
export type TimelineBuilderNotice = z.infer<typeof TimelineBuilderNoticeSchema>;

export function parseDocumentIngestionNotice(
  input: unknown,
): DocumentIngestionNotice {
  return DocumentIngestionNoticeSchema.parse(input);
}

export const DocumentEgestionNoticeSchema = GeneralNoticeSchema.extend({
  notificationType: z.literal('EGESTION'),
  data: z
    .object({
      accountId: z.string().min(1, 'accountId is required'),
      status: z.enum(WORKFLOW_STATUS_VALUES),
      errorMessage: z.string().optional(),
      filepath: z.string().min(1, 'filepath is required'),
    })
    .strict(),
});
export type DocumentEgestionNotice = z.infer<
  typeof DocumentEgestionNoticeSchema
>;

export function parseDocumentEgestionNotice(
  input: unknown,
): DocumentEgestionNotice {
  return DocumentEgestionNoticeSchema.parse(input);
}

export const CaseCreatedNoticeSchema = GeneralNoticeSchema.extend({
  notificationType: z.literal('CASE_CREATED'),
  data: z
    .object({
      accountId: z.string().min(1, 'accountId is required'),
      status: z.enum(WORKFLOW_STATUS_VALUES),
      errorMessage: z.string().optional(),
    })
    .strict(),
});
export type CaseCreatedNotice = z.infer<typeof CaseCreatedNoticeSchema>;

export const CaseDeletedNoticeSchema = GeneralNoticeSchema.extend({
  notificationType: z.literal('CASE_DELETED'),
  data: z
    .object({
      accountId: z.string().min(1, 'accountId is required'),
      status: z.enum(WORKFLOW_STATUS_VALUES),
      errorMessage: z.string().optional(),
    })
    .strict(),
});
export type CaseDeletedNotice = z.infer<typeof CaseDeletedNoticeSchema>;

const ChatMessageNoticeSchema = GeneralNoticeSchema.extend({
  notificationType: z.literal('CHAT_MESSAGE'),
  data: z.unknown(),
}).strict();

export const FeedbackRequiredAlertDataSchema = z
  .object({
    accountId: z.string().min(1, 'accountId is required'),
    sourceId: z.string().min(1, 'sourceId is required'),
    clientFeedbackRequestId: z
      .string()
      .min(1, 'clientFeedbackRequestId is required'),
    markdownPath: z.string().min(1, 'markdownPath is required'),
    status: z.enum(['FEEDBACK_REQUIRED', 'FEEDBACK_REQUESTED']),
  })
  .strict();
export type FeedbackRequiredAlertData = z.infer<
  typeof FeedbackRequiredAlertDataSchema
>;

export const AlertNoticeSchema = GeneralNoticeSchema.extend({
  notificationType: z.literal('ALERT'),
  data: FeedbackRequiredAlertDataSchema,
}).strict();
export type AlertNotice = z.infer<typeof AlertNoticeSchema>;

export const SpeakerNameMapSchema = z.record(
  z.string().regex(/^\d+$/, 'speaker ID must be numeric'),
  z.string().trim().min(1, 'speaker name is required'),
);
export type SpeakerNameMap = z.infer<typeof SpeakerNameMapSchema>;

export const SpeakerNameFeedbackMetadataSchema = z
  .object({
    date: z.string().trim().min(1).optional(),
    location: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).optional(),
  })
  .strict();
export type SpeakerNameFeedbackMetadata = z.infer<
  typeof SpeakerNameFeedbackMetadataSchema
>;

export const SpeakerNameFeedbackResponseSchema = z
  .object({
    speakerNames: SpeakerNameMapSchema,
    metadata: SpeakerNameFeedbackMetadataSchema.optional(),
  })
  .strict();
export type SpeakerNameFeedbackResponse = z.infer<
  typeof SpeakerNameFeedbackResponseSchema
>;

export const ClientFeedbackRequestSchema = z
  .object({
    id: z.string().min(1, 'id is required'),
    accountId: z.string().min(1, 'accountId is required'),
    sourceId: z.string().min(1, 'sourceId is required'),
    identifier: z.string().min(1, 'identifier is required'),
    type: z.literal('speakerNames'),
    status: z.enum(['pending', 'completed']),
    createdAt: z.string().min(1).optional(),
    input: z.unknown().optional(),
    markdownPath: z.string().min(1, 'markdownPath is required'),
    markdownSourceId: z.coerce.string().min(1).optional(),
    markdownUniqueId: z.string().min(1).optional(),
    response: SpeakerNameFeedbackResponseSchema.optional(),
  })
  .refine((request) => request.markdownSourceId || request.markdownUniqueId, {
    message: 'A markdownSourceId or markdownUniqueId is required',
  });
export type ClientFeedbackRequest = z.infer<typeof ClientFeedbackRequestSchema>;

export const NoticeSchema = z.discriminatedUnion('notificationType', [
  DeclarationNoticeSchema,
  ArgumentBuilderNoticeSchema,
  ChatMessageNoticeSchema,
  AlertNoticeSchema,
  DocumentIngestionNoticeSchema,
  DocumentEgestionNoticeSchema,
  CaseCreatedNoticeSchema,
  CaseDeletedNoticeSchema,
  TimelineBuilderNoticeSchema,
]);
export type Notice = z.infer<typeof NoticeSchema>;

const COSMOS_SYSTEM_PROPERTIES = [
  '_rid',
  '_self',
  '_etag',
  '_attachments',
  '_ts',
] as const;

/** Removes Cosmos DB system metadata before validating an application record. */
export function stripCosmosSystemProperties(input: unknown): unknown {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return input;
  }

  const record = { ...(input as Record<string, unknown>) };
  for (const property of COSMOS_SYSTEM_PROPERTIES) {
    delete record[property];
  }
  return record;
}

export const parseNotices = (input: unknown): Notice[] => {
  const notices = Array.isArray(input)
    ? input.map(stripCosmosSystemProperties)
    : input;
  return z.array(NoticeSchema).parse(notices);
};

/** Request content file schema */
export const RequestContentFileSchema = z.object({
  name: z.string(),
  fileId: z.string(),
  sourceUrl: z.url().nullable().optional(),
  pages: z.string().optional().nullable(),
});
export type RequestContentFile = z.infer<typeof RequestContentFileSchema>;

export const ArgumentBuilderReferenceSchema = z.looseObject({
  docId: z.string(),
  title: z.string().optional(),
  sourceUrl: z.string().optional(),
  headers: z.array(z.string()).optional(),
  pages: z.array(z.union([z.string(), z.number()])).optional(),
  position: z.number().optional(),
  sourceId: z.string().optional(),
  pageContent: z.string().optional(),
  ...DocumentStructuredMetadataShape,
});

export const ArgumentBuilderValidationSourceSchema =
  ArgumentBuilderReferenceSchema.pick({
    docId: true,
  }).extend({
    pages: z.array(z.union([z.string(), z.number()])).optional(),
  });

export const ArgumentBuilderValidationSchema = z.looseObject({
  claim: z.string(),
  explanation: z.string().optional(),
  isValid: z.boolean().optional(),
  isContradictory: z.boolean().optional(),
  isInferred: z.boolean().optional(),
  isReasonablyInferred: z.boolean().optional(),
  isNotFoundInContext: z.boolean().optional(),
  isSummaryOrConclusion: z.boolean().optional(),
  isImplied: z.boolean().optional(),
  isVague: z.boolean().optional(),
  contradictionStatement: z.string().optional(),
  contradictionSources: z.array(ArgumentBuilderReferenceSchema).optional(),
  sources: z.array(ArgumentBuilderValidationSourceSchema).optional(),
});

export const ArgumentBuilderOutputSchema = z.looseObject({
  initialArgument: z.string().optional(),
  counterArgument: z.string().optional(),
  finalArgument: z.string().optional(),
  sources: z.array(ArgumentBuilderReferenceSchema).optional(),
  context: z.array(ArgumentBuilderReferenceSchema).optional(),
  validationStatus: z.array(ArgumentBuilderValidationSchema).optional(),
  exhibits: z.array(QAExhibitSchema).optional(),
});

export type ArgumentBuilderReference = z.infer<
  typeof ArgumentBuilderReferenceSchema
>;
export type ArgumentBuilderValidation = z.infer<
  typeof ArgumentBuilderValidationSchema
>;
export type ArgumentBuilderOutput = z.infer<typeof ArgumentBuilderOutputSchema>;

/** Request schema */
export const RequestDataSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  sessionId: z.string(),
  input: z.string(),
  type: z.enum(['declaration', 'argument-builder', 'timeline-builder', 'qa']),
  status: z.enum(['started', 'completed', 'failed', 'generated']),
  output: z
    .unknown()
    .optional()
    .transform((value) => (value === undefined ? null : value)),
  oid: z.string(),
  startedAt: z.iso.datetime({ offset: true }),
  endedAt: z.iso.datetime({ offset: true }).nullish().transform(
    (value) => value ?? undefined,
  ),
  contents: z
    .union([
      z.string().transform((str) => {
        try {
          const parsed = JSON.parse(str);
          return z.array(RequestContentFileSchema).parse(parsed);
        } catch {
          return [];
        }
      }),
      z.array(RequestContentFileSchema),
      z.null(),
      z.undefined(),
    ])
    .optional()
    .transform((value) => {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      return [];
    }),
  sourceUrl: z.url().optional().nullable(),
  rawOutputJson: z.string().optional().nullable(),
});
export type RequestData = z.infer<typeof RequestDataSchema>;

const normalizeBuilderString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const candidateKeys = ['markdown', 'text', 'content', 'value'] as const;
    for (const key of candidateKeys) {
      if (typeof record[key] === 'string') {
        return record[key];
      }
    }
  }
  return null;
};

const normalizeBuilderTags = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const tags = value.filter(
    (entry): entry is string => typeof entry === 'string',
  );
  return tags.length > 0 ? tags : undefined;
};

const normalizeBuilderTemporalMetadata = (
  value: unknown,
): z.infer<typeof DocumentTemporalMetadataSchema> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const temporalMetadata = {
    year: normalizeBuilderString(record.year) ?? undefined,
    month: normalizeBuilderString(record.month) ?? undefined,
    day: normalizeBuilderString(record.day) ?? undefined,
    season: normalizeBuilderString(record.season) ?? undefined,
    quarter: normalizeBuilderString(record.quarter) ?? undefined,
  };
  return Object.values(temporalMetadata).some(Boolean)
    ? temporalMetadata
    : undefined;
};

const toUnknownList = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>);
  }
  return [];
};

const coerceBuilderJson = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
  }

  try {
    if (typeof atob === 'function') {
      return JSON.parse(atob(trimmed));
    }
  } catch {
    // ignore and retry with Buffer
  }

  try {
    if (typeof Buffer !== 'undefined') {
      const decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
      return JSON.parse(decoded);
    }
  } catch {
    // ignore
  }

  return trimmed;
};

const normalizeBuilderReferences = (
  value: unknown,
): ArgumentBuilderReference[] | undefined => {
  const normalizeReferenceHeaders = (
    record: Record<string, unknown>,
  ): string[] | undefined =>
    Array.isArray(record.headers)
      ? (record.headers.filter(
          (entry) => typeof entry === 'string',
        ) as string[])
      : undefined;

  const normalizeReferencePages = (
    record: Record<string, unknown>,
  ): (string | number)[] | undefined =>
    Array.isArray(record.pages)
      ? (record.pages.filter(
          (entry) => typeof entry === 'string' || typeof entry === 'number',
        ) as (string | number)[])
      : undefined;

  const extractReferenceDocId = (item: unknown): string | undefined => {
    if (typeof item === 'string') {
      const docId = item.trim();
      return docId || undefined;
    }

    if (!item || typeof item !== 'object') {
      return undefined;
    }

    const record = item as Record<string, unknown>;
    let rawDocId: string | undefined;
    if (typeof record.docId === 'string') {
      rawDocId = record.docId;
    } else if (typeof record.id === 'string') {
      rawDocId = record.id;
    }
    const docId = rawDocId?.trim();
    return docId || undefined;
  };

  const normalizeReferenceObject = (
    item: unknown,
  ): ArgumentBuilderReference | undefined => {
    if (!item || typeof item !== 'object') {
      return undefined;
    }

    const record = item as Record<string, unknown>;
    const docId = extractReferenceDocId(item);
    if (!docId) {
      return undefined;
    }

    let sourceUrl: string | undefined;
    if (typeof record.sourceUrl === 'string') {
      sourceUrl = record.sourceUrl;
    } else if (typeof record.url === 'string') {
      sourceUrl = record.url;
    }

    return {
      docId,
      title: typeof record.title === 'string' ? record.title : undefined,
      sourceUrl,
      headers: normalizeReferenceHeaders(record),
      pages: normalizeReferencePages(record),
      position:
        typeof record.position === 'number' ? record.position : undefined,
      sourceId:
        typeof record.sourceId === 'string' ? record.sourceId : undefined,
      pageContent:
        typeof record.pageContent === 'string' ? record.pageContent : undefined,
      tags: normalizeBuilderTags(record.tags),
      who: normalizeBuilderString(record.who) ?? undefined,
      what: normalizeBuilderString(record.what) ?? undefined,
      where: normalizeBuilderString(record.where) ?? undefined,
      why: normalizeBuilderString(record.why) ?? undefined,
      whenStarted: normalizeBuilderTemporalMetadata(
        record.whenStarted ?? record.when_started,
      ),
      whenEnded: normalizeBuilderTemporalMetadata(
        record.whenEnded ?? record.when_ended,
      ),
    };
  };

  const references: ArgumentBuilderReference[] = [];

  for (const item of toUnknownList(value)) {
    if (typeof item === 'string') {
      const docId = extractReferenceDocId(item);
      if (docId) {
        references.push({ docId });
      }
      continue;
    }

    const reference = normalizeReferenceObject(item);
    if (reference) {
      references.push(reference);
    }
  }

  return references.length > 0 ? references : undefined;
};

const normalizeBuilderValidations = (
  value: unknown,
): ArgumentBuilderValidation[] | undefined => {
  const toOptionalBoolean = (
    record: Record<string, unknown>,
    key: string,
  ): boolean | undefined =>
    typeof record[key] === 'boolean' ? record[key] : undefined;

  const normalizeValidation = (
    item: unknown,
  ): ArgumentBuilderValidation | null => {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const record = item as Record<string, unknown>;
    const claim =
      normalizeBuilderString(record.claim) ??
      normalizeBuilderString(record.statement);
    if (!claim) {
      return null;
    }

    return {
      claim,
      explanation: normalizeBuilderString(record.explanation) ?? undefined,
      isValid: toOptionalBoolean(record, 'isValid'),
      isContradictory: toOptionalBoolean(record, 'isContradictory'),
      isInferred: toOptionalBoolean(record, 'isInferred'),
      isReasonablyInferred: toOptionalBoolean(record, 'isReasonablyInferred'),
      isNotFoundInContext: toOptionalBoolean(record, 'isNotFoundInContext'),
      isSummaryOrConclusion: toOptionalBoolean(record, 'isSummaryOrConclusion'),
      isImplied: toOptionalBoolean(record, 'isImplied'),
      isVague: toOptionalBoolean(record, 'isVague'),
      contradictionStatement:
        normalizeBuilderString(record.contradictionStatement) ?? undefined,
      contradictionSources: normalizeBuilderReferences(
        record.contradictionSources,
      ),
      sources: normalizeBuilderReferences(record.sources),
    };
  };

  const validations: ArgumentBuilderValidation[] = [];

  for (const item of toUnknownList(value)) {
    const validation = normalizeValidation(item);
    if (!validation) {
      continue;
    }

    validations.push(validation);
  }

  return validations.length > 0 ? validations : undefined;
};

const tryNormalizeArgumentBuilderOutput = (
  candidate: unknown,
): ArgumentBuilderOutput | null => {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null;
  }

  const record = candidate as Record<string, unknown>;
  const initialArgument =
    normalizeBuilderString(record.initialArgument ?? record.initial_argument) ??
    undefined;
  const counterArgument =
    normalizeBuilderString(record.counterArgument ?? record.counter_argument) ??
    undefined;
  const finalArgument =
    normalizeBuilderString(record.finalArgument ?? record.final_argument) ??
    undefined;
  const sources = normalizeBuilderReferences(
    record.sources ?? record.citations ?? record.references,
  );
  const context = normalizeBuilderReferences(
    record.context ?? record.background,
  );
  const validationStatus = normalizeBuilderValidations(
    record.validationStatus ?? record.validations ?? record.validation,
  );

  const hasContent =
    !!initialArgument ||
    !!counterArgument ||
    !!finalArgument ||
    !!sources?.length ||
    !!context?.length ||
    !!validationStatus?.length;

  if (!hasContent) {
    return null;
  }

  const normalized: ArgumentBuilderOutput = {
    initialArgument,
    counterArgument,
    finalArgument,
    sources,
    context,
    validationStatus,
  };

  const exhibitsResult = z.array(QAExhibitSchema).safeParse(record.exhibits);
  if (exhibitsResult.success) {
    normalized.exhibits = exhibitsResult.data;
  }

  const parsed = ArgumentBuilderOutputSchema.safeParse(normalized);
  return parsed.success ? parsed.data : null;
};

export function parseArgumentBuilderOutput(
  input: unknown,
): ArgumentBuilderOutput | null {
  const visited = new Set<unknown>();
  const queue: unknown[] = [];
  const initial = coerceBuilderJson(input);
  if (initial !== null && initial !== undefined) {
    queue.push(initial);
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }
    visited.add(current);

    const normalized = tryNormalizeArgumentBuilderOutput(current);
    if (normalized) {
      return normalized;
    }

    for (const value of toUnknownList(current)) {
      const coerced = coerceBuilderJson(value);
      if (coerced !== null && coerced !== undefined) {
        queue.push(coerced);
      }
    }
  }

  return null;
}

export function parseRequestData(input: string): RequestData {
  let data: unknown;

  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch (error) {
      throw new Error(`Invalid JSON string: ${error}`);
    }
  } else {
    data = input;
  }

  return RequestDataSchema.parse(data);
}

/** Array of Request schema */
export const RequestDataArraySchema = z.array(RequestDataSchema);
export type RequestDataArray = z.infer<typeof RequestDataArraySchema>;

/**
 * Parses a string or JSON object into an array of Request objects
 * @param input - Either a JSON string or an already parsed object/array
 * @returns Array of validated Request objects
 * @throws ZodError if validation fails
 */
export function parseRequestDataArray(input: unknown): RequestDataArray {
  let data: unknown;

  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch (error) {
      throw new Error(`Invalid JSON string: ${error}`);
    }
  } else {
    data = input;
  }

  return RequestDataArraySchema.parse(data);
}

/* ───────────────────── Microsoft Graph User Schemas ───────────────────── */

/** Identity schema for user identities array */
export const GraphUserIdentitySchema = z.object({
  signInType: z.string(),
  issuer: z.string(),
  issuerAssignedId: z.string().nullable(),
});
export type GraphUserIdentity = z.infer<typeof GraphUserIdentitySchema>;

/** Authorization Info schema */
export const GraphAuthorizationInfoSchema = z.object({
  certificateUserIds: z.array(z.unknown()).default([]),
});
export type GraphAuthorizationInfo = z.infer<
  typeof GraphAuthorizationInfoSchema
>;

/** Cloud Realtime Communication Info schema */
export const GraphCloudRealtimeCommunicationInfoSchema = z.object({
  isSipEnabled: z.unknown().optional(),
});
export type GraphCloudRealtimeCommunicationInfo = z.infer<
  typeof GraphCloudRealtimeCommunicationInfoSchema
>;

/** On-Premises Extension Attributes schema */
export const GraphOnPremisesExtensionAttributesSchema = z.object({
  extensionAttribute1: z.unknown().optional(),
  extensionAttribute2: z.unknown().optional(),
  extensionAttribute3: z.unknown().optional(),
  extensionAttribute4: z.unknown().optional(),
  extensionAttribute5: z.unknown().optional(),
  extensionAttribute6: z.unknown().optional(),
  extensionAttribute7: z.unknown().optional(),
  extensionAttribute8: z.unknown().optional(),
  extensionAttribute9: z.unknown().optional(),
  extensionAttribute10: z.unknown().optional(),
  extensionAttribute11: z.unknown().optional(),
  extensionAttribute12: z.unknown().optional(),
  extensionAttribute13: z.unknown().optional(),
  extensionAttribute14: z.unknown().optional(),
  extensionAttribute15: z.unknown().optional(),
});
export type GraphOnPremisesExtensionAttributes = z.infer<
  typeof GraphOnPremisesExtensionAttributesSchema
>;

/** On-Premises SIP Info schema */
export const GraphOnPremisesSipInfoSchema = z.object({
  isSipEnabled: z.boolean(),
  sipDeploymentLocation: z.unknown().optional(),
  sipPrimaryAddress: z.unknown().optional(),
});
export type GraphOnPremisesSipInfo = z.infer<
  typeof GraphOnPremisesSipInfoSchema
>;

/** Microsoft Graph User schema */
export const GraphUserSchema = z.preprocess(normalizeGraphAttorneyField, z
  .object({
    id: z.string(),
    deletedDateTime: z.unknown().optional(),
    accountEnabled: z.boolean(),
    ageGroup: z.unknown().optional(),
    businessPhones: z.array(z.string()).default([]),
    city: z.string().nullable().optional(),
    createdDateTime: z.string(),
    creationType: z.string().nullable().optional(),
    companyName: z.unknown().optional(),
    consentProvidedForMinor: z.unknown().optional(),
    country: z.string().nullable().optional(),
    department: z.unknown().optional(),
    displayName: z.string(),
    employeeId: z.unknown().optional(),
    employeeHireDate: z.unknown().optional(),
    employeeLeaveDateTime: z.unknown().optional(),
    employeeType: z.unknown().optional(),
    faxNumber: z.unknown().optional(),
    givenName: z.string(),
    imAddresses: z.array(z.string()).default([]),
    infoCatalogs: z.array(z.unknown()).default([]),
    isLicenseReconciliationNeeded: z.boolean(),
    isManagementRestricted: z.unknown().optional(),
    isResourceAccount: z.unknown().optional(),
    jobTitle: z.unknown().optional(),
    legalAgeGroupClassification: z.unknown().optional(),
    mail: z.string().nullable().optional(),
    mailNickname: z.string(),
    mobilePhone: z.unknown().optional(),
    onPremisesDistinguishedName: z.unknown().optional(),
    officeLocation: z.unknown().optional(),
    onPremisesDomainName: z.unknown().optional(),
    onPremisesImmutableId: z.unknown().optional(),
    onPremisesLastSyncDateTime: z.unknown().optional(),
    onPremisesObjectIdentifier: z.unknown().optional(),
    onPremisesSecurityIdentifier: z.unknown().optional(),
    onPremisesSamAccountName: z.unknown().optional(),
    onPremisesSyncEnabled: z.unknown().optional(),
    onPremisesUserPrincipalName: z.unknown().optional(),
    otherMails: z.array(z.string()).default([]),
    passwordPolicies: z.string().nullable().optional(),
    postalCode: z.string().nullable().optional(),
    preferredDataLocation: z.unknown().optional(),
    preferredLanguage: z.unknown().optional(),
    proxyAddresses: z.array(z.string()).default([]),
    refreshTokensValidFromDateTime: z.string(),
    securityIdentifier: z.string(),
    showInAddressList: z.unknown().optional(),
    signInSessionsValidFromDateTime: z.string(),
    state: z.string().nullable().optional(),
    streetAddress: z.string().nullable().optional(),
    surname: z.string(),
    usageLocation: z.unknown().optional(),
    userPrincipalName: z.string(),
    externalUserConvertedOn: z.unknown().optional(),
    externalUserState: z.unknown().optional(),
    externalUserStateChangeDateTime: z.unknown().optional(),
    userType: z.string(),
    isAttorney: z
      .boolean()
      .nullable()
      .optional(),
    employeeOrgData: z.unknown().optional(),
    passwordProfile: z.unknown().optional(),
    assignedLicenses: z.array(z.unknown()).default([]),
    assignedPlans: z.array(z.unknown()).default([]),
    authorizationInfo: GraphAuthorizationInfoSchema.optional(),
    cloudRealtimeCommunicationInfo:
      GraphCloudRealtimeCommunicationInfoSchema.optional(),
    deviceKeys: z.array(z.unknown()).default([]),
    identities: z.array(GraphUserIdentitySchema).default([]),
    onPremisesExtensionAttributes:
      GraphOnPremisesExtensionAttributesSchema.optional(),
    onPremisesProvisioningErrors: z.array(z.unknown()).default([]),
    onPremisesSipInfo: GraphOnPremisesSipInfoSchema.optional(),
    provisionedPlans: z.array(z.unknown()).default([]),
    serviceProvisioningErrors: z.array(z.unknown()).default([]),
  })
  .transform((data) => ({
    ...data,
    // Create alias for the attorney field
    isAttorney:
      data.isAttorney ?? null,
  })));
export type GraphUser = z.infer<typeof GraphUserSchema>;

/** Microsoft Graph Users Response schema (OData response) */
export const GraphUsersResponseSchema = z.object({
  '@odata.context': z.string(),
  value: z.array(GraphUserSchema),
});
export type GraphUsersResponse = z.infer<typeof GraphUsersResponseSchema>;

export const CaseClosureSchema = z.object({
  eventKind: z.literal('AccountCleanup'),
  accountId: z.string(),
  deactivate: z.object({
    emailIngestion: z.boolean(),
    dataIngestion: z.boolean(),
    sharePoint: z.boolean(),
    account: z.boolean(),
  }),
});
export type CaseClosure = z.infer<typeof CaseClosureSchema>;

export const UserAccessStateResponseSchema = z.object({
  agreedToTerms: z.boolean(),
  isActive: z.boolean(),
});
export type UserAccessStateResponse = z.infer<
  typeof UserAccessStateResponseSchema
>;

/* ───────────── Parser Functions ───────────────────── */

/**
 * Parse a single Microsoft Graph user object
 * @param input - User data from Microsoft Graph API
 * @returns Validated GraphUser object with isAttorney alias
 * @throws ZodError if validation fails
 */
export function parseGraphUser(input: unknown): GraphUser {
  return GraphUserSchema.parse(input);
}

/**
 * Parse Microsoft Graph users response (OData format)
 * @param input - Either a JSON string or already parsed object
 * @returns Validated GraphUsersResponse object
 * @throws ZodError if validation fails
 */
export function parseGraphUsersResponse(input: unknown): GraphUsersResponse {
  let data: unknown;

  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch (error) {
      throw new Error(`Invalid JSON string: ${error}`);
    }
  } else {
    data = input;
  }

  return GraphUsersResponseSchema.parse(data);
}

/**
 * Parse an array of Microsoft Graph user objects
 * @param input - Either a JSON string or already parsed array
 * @returns Array of validated GraphUser objects
 * @throws ZodError if validation fails
 */
export function parseGraphUserArray(input: unknown): GraphUser[] {
  let data: unknown;

  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch (error) {
      throw new Error(`Invalid JSON string: ${error}`);
    }
  } else {
    data = input;
  }

  return z.array(GraphUserSchema).parse(data);
}

export function parseUserAccessStateResponse(
  input: unknown,
): UserAccessStateResponse {
  return UserAccessStateResponseSchema.parse(input);
}

export class UnauthorizedError extends Error {
  constructor(message?: string) {
    super(message || 'Unauthorized');
    this.name = 'UnauthorizedError';
  }
}

export class NotFoundException extends Error {
  constructor(message?: string) {
    super(message || 'Not Found');
    this.name = 'NotFoundException';
  }
}

export class BadRequestException extends Error {
  constructor(message?: string) {
    super(message || 'Bad Request');
    this.name = 'BadRequestException';
  }
}

export class InternalServerErrorException extends Error {
  constructor(message?: string) {
    super(message || 'Internal Server Error');
    this.name = 'InternalServerErrorException';
  }
}

export class ServiceUnavailableException extends Error {
  constructor(message?: string) {
    super(message || 'Service Unavailable');
    this.name = 'ServiceUnavailableException';
  }
}

// Staffing model

export const StaffModelSchema = z.object({
  staffId: z.string(),
  displayName: z.string(),
  focus: z.string().optional(), // e.g., "Litigation", "Corporate"
  highlight: z.string().optional(), // e.g., "Expert in e-discovery and document review"
  experience: z.string().optional(), // e.g., ["5 years at BigLaw Firm", "Handled 100+ cases"]
  role: z.string(), // e.g., "Paralegal", "Attorney"
  title: z.string().optional(), // e.g., "Senior Paralegal"
  isCurrent: z.boolean().optional().default(true), // whether currently staffed on the case
});

export type StaffModel = z.infer<typeof StaffModelSchema>;

export function parseStaffModel(input: unknown): StaffModel {
  return StaffModelSchema.parse(input);
}

export interface WebPubSubLike {
  on: (
    event: string,
    handler: (e: { message?: { data?: unknown } }) => void,
  ) => void;
  start: () => Promise<void>;
  joinGroup: (groupName: string) => Promise<void>;
}
