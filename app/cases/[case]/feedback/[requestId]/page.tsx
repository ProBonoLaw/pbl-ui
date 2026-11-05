'use client';

import CasePageTemplate from '@/components/cases/CasePageTemplate';
import MarkdownViewer from '@/components/MarkdownViewer';
import { FormActions, FormSection } from '@/components/forms/FormSection';
import { useAuth } from '@/hooks/useAuth';
import { extractSpeakerLabels, getSpeakerId } from '@/lib/feedbackSpeakers';
import {
  ClientFeedbackRequestSchema,
  type ClientFeedbackRequest,
} from '@/lib/types';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';

const SCOPES = process.env.NEXT_PUBLIC_AAD_API_SCOPE
  ? process.env.NEXT_PUBLIC_AAD_API_SCOPE.split(',').filter(Boolean)
  : ['openid', 'profile'];

export default function FeedbackCenterPage({
  params,
}: {
  params: Promise<{ case: string; requestId: string }>;
}) {
  const { case: caseId, requestId } = use(params);
  const { fetchWithAuth } = useAuth();
  const [feedbackRequest, setFeedbackRequest] =
    useState<ClientFeedbackRequest | null>(null);
  const [markdown, setMarkdown] = useState('');
  const [speakerNames, setSpeakerNames] = useState<Record<string, string>>({});
  const [metadata, setMetadata] = useState({
    date: '',
    location: '',
    description: '',
  });
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const feedbackApiUrl = `/api/accounts/cases/${encodeURIComponent(caseId)}/feedback-requests/${encodeURIComponent(requestId)}`;

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;

    async function loadFeedback() {
      setLoading(true);
      setError(null);
      setMediaError(null);
      try {
        const detailResponse = await fetchWithAuth(
          feedbackApiUrl,
          { method: 'GET', signal: controller.signal },
          SCOPES,
        );
        if (!detailResponse.ok) {
          if (detailResponse.status === 404) {
            throw new Error(
              'This feedback request is missing or has been removed.',
            );
          }
          throw new Error('Unable to load this feedback request.');
        }
        const detail = ClientFeedbackRequestSchema.parse(
          await detailResponse.json(),
        );
        setFeedbackRequest(detail);

        const markdownResponse = await fetchWithAuth(
          `${feedbackApiUrl}/asset?asset=markdown`,
          { method: 'GET', signal: controller.signal },
          SCOPES,
        );
        if (!markdownResponse.ok) {
          throw new Error(
            'Unable to load the transcript for this feedback request.',
          );
        }
        const transcript = await markdownResponse.text();
        setMarkdown(transcript);
        const labels = extractSpeakerLabels(transcript);
        setSpeakerNames(
          Object.fromEntries(
            labels.map((label) => [
              label,
              detail.response?.speakerNames[getSpeakerId(label) ?? ''] ?? '',
            ]),
          ),
        );
        setMetadata({
          date: detail.response?.metadata?.date ?? '',
          location: detail.response?.metadata?.location ?? '',
          description: detail.response?.metadata?.description ?? '',
        });

        const mediaResponse = await fetchWithAuth(
          `${feedbackApiUrl}/asset?asset=media`,
          { method: 'GET', signal: controller.signal },
          SCOPES,
        );
        if (!mediaResponse.ok) {
          setMediaError(
            'The source media could not be loaded. You can still review the transcript.',
          );
          return;
        }
        const media = await mediaResponse.blob();
        objectUrl = URL.createObjectURL(media);
        setMediaUrl(objectUrl);
        setMediaType(media.type);
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === 'AbortError') {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load this feedback request.',
        );
      } finally {
        setLoading(false);
      }
    }

    void loadFeedback();
    return () => {
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [feedbackApiUrl, fetchWithAuth]);

  const speakerLabels = Object.keys(speakerNames);
  const isCompleted = feedbackRequest?.status === 'completed';
  const canEditSpeakerNames = !isCompleted || isEditing;

  async function submitFeedback(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!feedbackRequest || !canEditSpeakerNames) {
      return;
    }

    const speakerNameResponse = Object.fromEntries(
      Object.entries(speakerNames).flatMap(([speaker, name]) => {
        const speakerId = getSpeakerId(speaker);
        return speakerId ? [[speakerId, name.trim()]] : [];
      }),
    );
    const feedbackMetadata = {
      ...(metadata.date.trim() ? { date: metadata.date.trim() } : {}),
      ...(metadata.location.trim()
        ? { location: metadata.location.trim() }
        : {}),
      ...(metadata.description.trim()
        ? { description: metadata.description.trim() }
        : {}),
    };
    if (
      speakerLabels.length === 0 ||
      Object.keys(speakerNameResponse).length !== speakerLabels.length ||
      Object.values(speakerNameResponse).some((name) => name.length === 0)
    ) {
      setError('Enter a name for every speaker before submitting feedback.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const responseResult = await fetchWithAuth(
        feedbackApiUrl,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            response: {
              speakerNames: speakerNameResponse,
              ...(Object.keys(feedbackMetadata).length
                ? { metadata: feedbackMetadata }
                : {}),
            },
          }),
        },
        SCOPES,
      );
      if (!responseResult.ok) {
        const errorBody = (await responseResult.json().catch(() => null)) as {
          error?: unknown;
        } | null;
        throw new Error(
          typeof errorBody?.error === 'string'
            ? errorBody.error
            : 'Unable to save your speaker names. Please try again.',
        );
      }
      const updated = ClientFeedbackRequestSchema.parse(
        await responseResult.json(),
      );
      setFeedbackRequest(updated);
      setIsEditing(false);
      setSaveMessage(
        isCompleted
          ? 'Speaker names updated. This request remains complete.'
          : 'Feedback saved. This request is complete.',
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to save your speaker names. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <CasePageTemplate
      params={params}
      title="Feedback Center"
      isLoading={loading}>
      {error && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </p>
      )}
      {!loading && !error && feedbackRequest && (
        <div className="space-y-6 pb-6">
          <Link
            href="/feedback"
            className="inline-flex items-center rounded-md px-2 py-1 text-sm font-medium text-indigo-700 hover:bg-indigo-50 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:text-indigo-200 dark:hover:bg-white/5">
            Back to Feedback Center
          </Link>
          <section className="rounded-lg border border-gray-200 p-4 dark:border-white/10">
            <h2 className="text-xl font-semibold">Identify the speakers</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Review the source media and transcript, then replace each speaker
              label with the person&apos;s name.
            </p>
            {isCompleted && (
              <p className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-500/10 dark:text-green-200">
                This feedback request has already been completed.
              </p>
            )}
            {saveMessage && (
              <p className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-500/10 dark:text-green-200">
                {saveMessage}
              </p>
            )}
          </section>

          <section className="rounded-lg border border-gray-200 p-4 dark:border-white/10">
            <h2 className="text-lg font-semibold">Source media</h2>
            {mediaUrl ? (
              mediaType.startsWith('audio/') ? (
                <audio className="mt-3 w-full" controls src={mediaUrl} />
              ) : (
                <video
                  className="mt-3 max-h-[36rem] w-full"
                  controls
                  src={mediaUrl}
                />
              )
            ) : (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                {mediaError ?? 'Loading source media...'}
              </p>
            )}
          </section>

          <form onSubmit={submitFeedback} className="space-y-10">
            <FormSection title="Speaker Names" description="Identify the people in the transcript." fieldsClassName="block">
              {speakerLabels.length ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {speakerLabels.map((speaker) => (
                    <label key={speaker} className="block">
                      <span className="text-sm font-medium">{speaker}</span>
                      <input
                        value={speakerNames[speaker] ?? ''}
                        onChange={(event) =>
                          setSpeakerNames((names) => ({
                            ...names,
                            [speaker]: event.target.value,
                          }))
                        }
                        disabled={!canEditSpeakerNames || saving}
                        placeholder="Person's name"
                        className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-red-700 dark:text-red-200">
                  No speaker labels were found in the transcript.
                </p>
              )}
            </FormSection>
            <FormSection title="Optional Metadata" description="Add a relevant date, location, or description." fieldsClassName="block">
              <fieldset>
                <legend className="sr-only">Optional metadata</legend>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium">Date</span>
                    <input
                      type="date"
                      value={metadata.date}
                      onChange={(event) =>
                        setMetadata((current) => ({
                          ...current,
                          date: event.target.value,
                        }))
                      }
                      disabled={!canEditSpeakerNames || saving}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium">Location</span>
                    <input
                      value={metadata.location}
                      onChange={(event) =>
                        setMetadata((current) => ({
                          ...current,
                          location: event.target.value,
                        }))
                      }
                      disabled={!canEditSpeakerNames || saving}
                      placeholder="Location"
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
                    />
                  </label>
                </div>
                <label className="mt-4 block">
                  <span className="text-sm font-medium">Description</span>
                  <textarea
                    value={metadata.description}
                    onChange={(event) =>
                      setMetadata((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    disabled={!canEditSpeakerNames || saving}
                    placeholder="Description"
                    rows={4}
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                </label>
              </fieldset>
            </FormSection>
            <FormActions>
              {isCompleted && !isEditing && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(true);
                    setSaveMessage(null);
                  }}
                  className="mt-5 rounded-md border border-indigo-600 px-4 py-2 font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-400 dark:text-indigo-200 dark:hover:bg-white/5">
                  Edit
                </button>
              )}
              {canEditSpeakerNames && (
                <button
                  type="submit"
                  disabled={saving || speakerLabels.length === 0}
                  className="mt-5 rounded-md bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">
                  {saving
                    ? 'Saving...'
                    : isCompleted
                      ? 'Save'
                      : 'Submit speaker names'}
                </button>
              )}
            </FormActions>
          </form>

          <section className="rounded-lg border border-gray-200 p-4 dark:border-white/10">
            <h2 className="text-lg font-semibold">Transcript</h2>
            <div className="mt-3">
              <MarkdownViewer markdown={markdown} />
            </div>
          </section>
        </div>
      )}
    </CasePageTemplate>
  );
}
