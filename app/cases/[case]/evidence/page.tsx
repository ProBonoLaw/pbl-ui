'use client';

import {
  Combobox,
  ComboboxInput,
  ComboboxLabel,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/react';
import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';

import CasePageTemplate from '@/components/cases/CasePageTemplate';
import { formatDocumentTemporalMetadata } from '@/components/DocumentTemporalMetadataDate';
import Pagination from '@/components/Pagination';
import ProxiedIFrame from '@/components/ProxiedIFrame';
import SearchableSelect from '@/components/profile/SearchableSelect';
import { useAuth } from '@/hooks/useAuth';
import { DocumentTemporalMetadataSchema } from '@/lib/types';
import {
  EVIDENCE_FAMILIES,
  MAX_EVIDENCE_SEARCH_SKIP,
  EvidenceSearchResponseSchema,
  EvidenceValuesSchema,
  type EvidenceFamily,
  type EvidenceExplorerSearchInput,
  type EvidenceRecord,
  type EvidenceSearchResponse,
  type EvidenceValues,
} from '@/lib/evidenceSearch';

const PAGE_SIZE = 20;
const MAX_PAGE = Math.floor(MAX_EVIDENCE_SEARCH_SKIP / PAGE_SIZE) + 1;
const BROWSING_LIMIT = MAX_PAGE * PAGE_SIZE;

const familyLabels: Record<EvidenceFamily, string> = {
  claim: 'Claims',
  fact: 'Facts',
  event: 'Events',
};

function formatEvidenceDate(value: EvidenceRecord['whenStarted']) {
  if (value === null) {
    return null;
  }
  let metadata = value;
  if (typeof value === 'string') {
    const text = value.trim();
    if (text.startsWith('{')) {
      try {
        const decoded: unknown = JSON.parse(text);
        if (decoded === null || typeof decoded !== 'object' || Array.isArray(decoded)) {
          return null;
        }
        metadata = decoded as Record<string, unknown>;
      } catch {
        return null;
      }
    } else {
      const date = text.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?(?:T.*)?$/);
      return date
        ? formatDocumentTemporalMetadata({ year: date[1], month: date[2], day: date[3] })
        : text || null;
    }
  }
  const parsed = DocumentTemporalMetadataSchema.safeParse(
    Object.fromEntries(
      Object.entries(metadata).map(([key, part]) => [
        key,
        typeof part === 'number' ? String(part) : part,
      ]),
    ),
  );
  return parsed.success ? formatDocumentTemporalMetadata(parsed.data) : null;
}

function MultiSelect({
  id,
  label,
  options,
  selected,
  onChange,
}: Readonly<{
  id: string;
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}>) {
  const [query, setQuery] = useState('');
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) {
      return options;
    }
    return options.filter((option) =>
      option.toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [options, query]);
  const handleChange = (nextValues: string[]) => {
    onChange(nextValues);
    setQuery('');
  };

  return (
    <div>
      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selected.map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`Remove ${value} from ${label}`}
              onClick={() => onChange(selected.filter((item) => item !== value))}
              className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs text-indigo-800 dark:bg-indigo-400/20 dark:text-indigo-200">
              {value} <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}
      <Combobox
        multiple
        value={selected}
        onChange={handleChange}
        virtual={{ options: filteredOptions }}>
        <div className="relative mt-2">
          <ComboboxLabel className="block text-sm font-medium text-gray-900 dark:text-white">
            {label}
          </ComboboxLabel>
          <ComboboxInput
            aria-label={label}
            id={id}
            displayValue={() => query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Select ${label.toLocaleLowerCase()}`}
            className="mt-2 block w-full rounded-md bg-white px-3 py-2 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 dark:bg-white/5 dark:text-white dark:outline-white/10"
          />
          <ComboboxOptions
            modal={false}
            className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-sm shadow-lg ring-1 ring-black/10 focus:outline-hidden dark:bg-gray-800 dark:ring-white/10">
            {({ option }: { option: string }) => (
              <ComboboxOption
                key={option}
                value={option}
                className="flex cursor-default items-center gap-2 px-3 py-2 text-gray-900 data-focus:bg-indigo-600 data-focus:text-white dark:text-white">
                <span className="w-4 text-indigo-600 group-data-selected:visible dark:text-indigo-300">
                  {selected.includes(option) ? '✓' : ''}
                </span>
                {option}
              </ComboboxOption>
            )}
          </ComboboxOptions>
        </div>
      </Combobox>
    </div>
  );
}

function EvidenceResult({
  record,
  caseId,
}: Readonly<{ record: EvidenceRecord; caseId: string }>) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const resultId = useId();
  const headingId = `${resultId}-heading`;
  const previewId = `${resultId}-preview`;
  const whyValue = record.why?.trim();
  const why = whyValue && whyValue.toLowerCase() !== 'unknown' ? whyValue : null;
  const title = record.what || why || 'Evidence entry';
  const previewTitle = `Source preview for ${title}`;
  const started = formatEvidenceDate(record.whenStarted);
  const ended = formatEvidenceDate(record.whenEnded);
  const asOf = formatDocumentTemporalMetadata(record.asOf);
  const people = record.who?.join(', ');

  return (
    <article aria-labelledby={headingId} className="relative rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap gap-2">
        {record.tags?.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-800 dark:bg-orange-400/15 dark:text-orange-200">
            {tag}
          </span>
        ))}
      </div>
      <h2 id={headingId} className="mt-3 text-base font-semibold text-gray-950 dark:text-white">
        {title}
      </h2>
      {record.what && why && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
          {why}
        </p>
      )}
      <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        {people && (
          <div>
            <dt className="font-medium text-gray-600 dark:text-gray-400">Who</dt>
            <dd className="mt-0.5 text-gray-900 dark:text-gray-100">{people}</dd>
          </div>
        )}
        {record.where && (
          <div>
            <dt className="font-medium text-gray-600 dark:text-gray-400">Where</dt>
            <dd className="mt-0.5 text-gray-900 dark:text-gray-100">{record.where}</dd>
          </div>
        )}
        <div>
          <dt className="font-medium text-gray-600 dark:text-gray-400">When</dt>
          <dd className="mt-0.5 text-gray-900 dark:text-gray-100">
            {[started, ended].filter(Boolean).join(' – ') || 'Not available'}
          </dd>
        </div>
        {asOf && (
          <div>
            <dt className="font-medium text-gray-600 dark:text-gray-400">As of</dt>
            <dd className="mt-0.5 text-gray-900 dark:text-gray-100">{asOf}</dd>
          </div>
        )}
        {record.source && (
          <div>
            <dt className="font-medium text-gray-600 dark:text-gray-400">Source</dt>
            <dd className="mt-0.5 text-gray-900 dark:text-gray-100">
              <button
                type="button"
                aria-expanded={previewOpen}
                aria-controls={previewId}
                onClick={() => setPreviewOpen((open) => !open)}
                className="inline-flex min-h-11 min-w-11 cursor-pointer items-center rounded-md px-3 py-2 text-left text-indigo-700 underline underline-offset-2 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:text-indigo-300 dark:hover:bg-white/5 dark:focus-visible:outline-indigo-300">
                {previewOpen ? 'Hide source preview' : 'View source'}
                <span className="sr-only"> for {title}</span>
              </button>
            </dd>
          </div>
        )}
        {record.sourceId && (
          <div>
            <dt className="font-medium text-gray-600 dark:text-gray-400">Source ID</dt>
            <dd className="mt-0.5 break-all text-gray-900 dark:text-gray-100">
              {record.sourceId}
            </dd>
          </div>
        )}
        {record.pages && record.pages.length > 0 && (
          <div>
            <dt className="font-medium text-gray-600 dark:text-gray-400">Pages</dt>
            <dd className="mt-0.5 text-gray-900 dark:text-gray-100">
              {record.pages.join(', ')}
            </dd>
          </div>
        )}
      </dl>
      {record.source && (
        <div
          id={previewId}
          role="region"
          aria-label={previewTitle}
          hidden={!previewOpen}
          className="mt-4">
          {previewOpen && (
            <ProxiedIFrame src={record.source} caseId={caseId} title={previewTitle} />
          )}
        </div>
      )}
    </article>
  );
}

export default function EvidenceExplorerPage({
  params,
}: {
  params: Promise<{ case: string }>;
}) {
  const { fetchWithAuth } = useAuth();
  const [caseId, setCaseId] = useState<string | null>(null);
  const [values, setValues] = useState<EvidenceValues | null>(null);
  const [families, setFamilies] = useState<EvidenceFamily[]>(['claim']);
  const [query, setQuery] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [who, setWho] = useState<string[]>([]);
  const [where, setWhere] = useState('');
  const [startedFrom, setStartedFrom] = useState('');
  const [startedTo, setStartedTo] = useState('');
  const [endedFrom, setEndedFrom] = useState('');
  const [endedTo, setEndedTo] = useState('');
  const [loadingValues, setLoadingValues] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResult, setSearchResult] =
    useState<EvidenceSearchResponse | null>(null);
  const [submittedFilters, setSubmittedFilters] =
    useState<Omit<EvidenceExplorerSearchInput, 'top' | 'skip'> | null>(null);

  useEffect(() => {
    params.then(({ case: id }) => setCaseId(id));
  }, [params]);

  useEffect(() => {
    if (!caseId) {
      return;
    }

    let canceled = false;
    setLoadingValues(true);
    setError(null);
    void (async () => {
      try {
        const response = await fetchWithAuth(
          `/api/accounts/cases/${encodeURIComponent(caseId)}/evidence/search/values`,
          { cache: 'no-store' },
        );
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error ?? 'Could not load evidence filters.');
        }
        const body: unknown = await response.json();
        const parsed = EvidenceValuesSchema.safeParse(
          (body as { data?: unknown }).data,
        );
        if (!parsed.success) {
          throw new Error('Evidence filters returned an invalid response.');
        }
        if (!canceled) {
          setValues(parsed.data);
        }
      } catch (loadError) {
        if (!canceled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load evidence filters.',
          );
        }
      } finally {
        if (!canceled) {
          setLoadingValues(false);
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, [caseId, fetchWithAuth]);

  const submitSearch = async (
    skip: number,
    filters: Omit<EvidenceExplorerSearchInput, 'top' | 'skip'>,
  ) => {
    if (!caseId || filters.families.length === 0 || skip > MAX_EVIDENCE_SEARCH_SKIP) {
      return;
    }

    setSearching(true);
    setError(null);
    try {
      const response = await fetchWithAuth(
        `/api/accounts/cases/${encodeURIComponent(caseId)}/evidence/search`,
        {
          method: 'POST',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...filters,
            top: PAGE_SIZE,
            skip,
          }),
        },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? 'Evidence search failed.');
      }
      const body: unknown = await response.json();
      const parsed = EvidenceSearchResponseSchema.safeParse(
        (body as { data?: unknown }).data,
      );
      if (!parsed.success) {
        throw new Error('Evidence search returned an invalid response.');
      }
      setSearchResult(parsed.data);
      setSubmittedFilters(filters);
    } catch (searchError) {
      setSearchResult(null);
      setError(
        searchError instanceof Error
          ? searchError.message
          : 'Evidence search failed.',
      );
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const dateRange = (from: string, to: string) => {
      if (!from && !to) {
        return undefined;
      }
      return { ...(from ? { from } : {}), ...(to ? { to } : {}) };
    };
    void submitSearch(0, {
      families,
      query,
      tags,
      who,
      ...(where ? { where } : {}),
      ...(dateRange(startedFrom, startedTo)
        ? { whenStarted: dateRange(startedFrom, startedTo) }
        : {}),
      ...(dateRange(endedFrom, endedTo)
        ? { whenEnded: dateRange(endedFrom, endedTo) }
        : {}),
    });
  };

  const optionalTagOptions = (values?.tags ?? []).filter(
    (tag) => !EVIDENCE_FAMILIES.includes(tag as EvidenceFamily),
  );
  const whereOptions = (values?.where ?? []).map((value) => ({
    value,
    label: value,
  }));
  const canGoNext =
    searchResult !== null &&
    searchResult.skip + PAGE_SIZE <= MAX_EVIDENCE_SEARCH_SKIP &&
    searchResult.results.length === PAGE_SIZE &&
    (searchResult.totalCount === null ||
      searchResult.skip + searchResult.results.length < searchResult.totalCount);

  return (
    <CasePageTemplate
      params={params}
      title="Evidence Explorer"
      isLoading={loadingValues}>
      <div className="w-full space-y-6 pb-8">
        <div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Search claims, facts, and events in this case.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
          <fieldset>
            <legend className="text-sm font-semibold text-gray-900 dark:text-white">
              Evidence types (all must match)
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {EVIDENCE_FAMILIES.map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  aria-pressed={families.includes(candidate)}
                  onClick={() =>
                    setFamilies((selected) =>
                      selected.includes(candidate)
                        ? selected.filter((value) => value !== candidate)
                        : EVIDENCE_FAMILIES.filter((value) =>
                          value === candidate || selected.includes(value),
                        ),
                    )
                  }
                  className={`rounded-md border px-3 py-2 text-sm font-medium ${families.includes(candidate)
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-200'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-white/20 dark:text-gray-200 dark:hover:bg-white/5'
                    }`}>
                  {familyLabels[candidate]}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label
              htmlFor="evidence-query"
              className="block text-sm font-medium text-gray-900 dark:text-white">
              Search terms
            </label>
            <input
              id="evidence-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Leave blank to browse all matching evidence"
              className="mt-2 block w-full rounded-md bg-white px-3 py-2 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 dark:bg-white/5 dark:text-white dark:outline-white/10"
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <MultiSelect
              id="evidence-tags"
              label="Additional tags (all must match)"
              options={optionalTagOptions}
              selected={tags}
              onChange={setTags}
            />
            <MultiSelect
              id="evidence-who"
              label="Who (any may match)"
              options={values?.who ?? []}
              selected={who}
              onChange={setWho}
            />
            <div>
              <label
                htmlFor="evidence-where"
                className="block text-sm font-medium text-gray-900 dark:text-white">
                Where
              </label>
              <div className="mt-2">
                <SearchableSelect
                  id="evidence-where"
                  ariaLabel="Where"
                  placeholder="Any location"
                  options={whereOptions}
                  value={where}
                  onChange={setWhere}
                  disabled={whereOptions.length === 0}
                />
              </div>
              {where && (
                <button
                  type="button"
                  onClick={() => setWhere('')}
                  className="mt-2 text-xs text-indigo-700 underline dark:text-indigo-300">
                  Clear location
                </button>
              )}
            </div>
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="text-sm font-medium text-gray-900 dark:text-white">
                When started
              </legend>
              <label className="text-xs text-gray-600 dark:text-gray-400">
                From
                <input
                  aria-label="When started from"
                  type="date"
                  value={startedFrom}
                  onChange={(event) => setStartedFrom(event.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/20 dark:bg-gray-900 dark:text-white"
                />
              </label>
              <label className="text-xs text-gray-600 dark:text-gray-400">
                To
                <input
                  aria-label="When started to"
                  type="date"
                  value={startedTo}
                  onChange={(event) => setStartedTo(event.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/20 dark:bg-gray-900 dark:text-white"
                />
              </label>
            </fieldset>
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="text-sm font-medium text-gray-900 dark:text-white">
                When ended
              </legend>
              <label className="text-xs text-gray-600 dark:text-gray-400">
                From
                <input
                  aria-label="When ended from"
                  type="date"
                  value={endedFrom}
                  onChange={(event) => setEndedFrom(event.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/20 dark:bg-gray-900 dark:text-white"
                />
              </label>
              <label className="text-xs text-gray-600 dark:text-gray-400">
                To
                <input
                  aria-label="When ended to"
                  type="date"
                  value={endedTo}
                  onChange={(event) => setEndedTo(event.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/20 dark:bg-gray-900 dark:text-white"
                />
              </label>
            </fieldset>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4 dark:border-white/10">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Choose at least one evidence type. Results must contain every selected type tag.
            </p>
            <button
              type="submit"
              disabled={loadingValues || searching || families.length === 0}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">
              {searching ? 'Searching…' : 'Search evidence'}
            </button>
          </div>
        </form>

        {error && (
          <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-400/10 dark:text-red-200">
            {error}
          </p>
        )}

        {searchResult && (
          <section aria-live="polite" className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-gray-950 dark:text-white">
                Search results
              </h2>
              {searchResult.totalCount !== null && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {searchResult.totalCount} matches
                </p>
              )}
            </div>
            {searchResult.results.length > 0 ? (
              <div className="space-y-3">
                {searchResult.results.map((record, index) => (
                  <EvidenceResult
                    key={`${record.sourceId ?? 'evidence'}-${searchResult.skip + index}`}
                    record={record}
                    caseId={caseId!}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600 dark:border-white/20 dark:text-gray-400">
                No evidence matched these filters.
              </p>
            )}
            <Pagination
              currentPage={Math.floor(searchResult.skip / PAGE_SIZE) + 1}
              disabled={searching}
              hasNextPage={canGoNext}
              itemCount={searchResult.results.length}
              maxPage={MAX_PAGE}
              onPageChange={(page) => {
                if (submittedFilters) {
                  void submitSearch((page - 1) * PAGE_SIZE, submittedFilters);
                }
              }}
              pageSize={PAGE_SIZE}
              totalItems={searchResult.totalCount}
            />
            {(searchResult.totalCount === null || searchResult.totalCount > BROWSING_LIMIT) && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                You can browse up to {BROWSING_LIMIT.toLocaleString('en-US')} matching results.
                Narrow your filters to find additional evidence.
              </p>
            )}
          </section>
        )}
      </div>
    </CasePageTemplate>
  );
}
