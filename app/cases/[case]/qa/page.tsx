'use client';
import { logger } from "@/lib/logger";
import CaseHeadliner from '@/components/CaseHeadliner';
import CasePageTemplate from '@/components/cases/CasePageTemplate';
import { useAuth } from '@/hooks/useAuth';
import { invokeFormSubmit } from '@/lib/textAreaInvokeForm';
import { QAInteractionSlimModel } from '@/lib/types';
import { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import { QaInteraction, useQAChatExporter } from '@/hooks/useQAChatExporter';
import ProgressModal from '@/components/qa/ProgressModal';
import remarkGfm from 'remark-gfm';
import { useCase } from '@/hooks/useCase';
import SelectionList, {
  SelectionOption,
} from '@/components/forms/SelectionList';
import Slider from '@/components/forms/Slider';
import AiOutputNotice from '@/components/AiOutputNotice';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';

const verbosityOptions: SelectionOption<'low' | 'medium' | 'high'>[] = [
  { id: 1, name: 'Brief', value: 'low' },
  { id: 2, name: 'Detailed', value: 'medium' },
  { id: 3, name: 'Verbose', value: 'high' },
];

export default function CasePage({
  params,
}: {
  params: Promise<{ case: string }>;
}) {
  const { fetchWithAuth, account } = useAuth();
  const [caseId, setCaseId] = useState<string | null>(null);
  const { chatData, clearChatData, addChatData, exportChatAsDocx } =
    useQAChatExporter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [swapRoles, setSwapRoles] = useState<boolean>(false);
  const [controlsOpen, setControlsOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { case: caseId } = await params;
      setCaseId(caseId);
      setSessionId(crypto.randomUUID());
    })();
  }, [params]);

  const { originalCaseRecord, loading, error } = useCase(caseId);
  const currentCaseRecord =
    !loading && !error && originalCaseRecord
      ? originalCaseRecord.casesAccounts[0]?.record
      : null;
  const controlVerbosity = currentCaseRecord
    ? (currentCaseRecord?.extendedControls?.verbosity ?? false)
    : false;
  const swapRolesControl = currentCaseRecord
    ? (currentCaseRecord?.extendedControls?.swapRoles ?? false)
    : false;

  const [verbosityLevel, setVerbosityLevel] = useState<
    'low' | 'medium' | 'high' | undefined
  >(undefined);

  useEffect(() => {
    if (controlVerbosity && !verbosityLevel) {
      setVerbosityLevel('low');
    }
  }, [controlVerbosity, verbosityLevel]);

  const submitRequest = async (
    caseId: string,
    sessionId: string,
    query: string,
  ) => {
    try {
      setIsProcessing(true);
      const newInteraction: QaInteraction = {
        question: query,
        date: new Date(),
        responses: [],
        swapRoles,
      };
      addChatData(newInteraction);
      logger.info('Submitting QA comment...');
      const res = await fetchWithAuth(`/api/accounts/cases/${caseId}/qa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({
          sessionId,
          input: query,
          verbosityLevel,
          swapRoles: swapRoles ? true : undefined,
        }),
      });
      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}`);
      }
      const json = await res.json();
      const adjustedResponse = QAInteractionSlimModel.parse(json.data);
      const qaResponse = adjustedResponse.data;
      newInteraction.responses.push({
        ...qaResponse,
        date: new Date(),
      });
      logger.info('QA comment submitted:', json);
    } catch (e: unknown) {
      const error = e as Error;
      alert(
        `Error submitting QA comment: ${error.message ?? 'Request failed'}`,
      );
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatData]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.target as HTMLFormElement);
    const requestText = formData.get('requestText');
    const query = requestText?.toString().trim();
    if (query) {
      await submitRequest(caseId!, sessionId!, query);
      const form = event.target as HTMLFormElement;
      form.reset();
    }
  };

  return (
    <CasePageTemplate
      params={params}
      title={
        !loading &&
        !error &&
        originalCaseRecord && (
          <>
            <CaseHeadliner
              flush
              caseDetails={
                originalCaseRecord.casesAccounts[0]?.record || undefined
              }
              pageTitle="QA"
            />
          </>
        )
      }
      isLoading={loading}
      contentClassName="h-full min-h-0 overflow-hidden"
      actionNotice={<AiOutputNotice />}
      actionSection={
        !loading && !error && originalCaseRecord ? (
          <div className="flex justify-end [@media(max-height:500px)]:absolute [@media(max-height:500px)]:right-6 [@media(max-height:500px)]:top-6 [@media(max-height:500px)]:!mt-0">
            <button
              type="button"
              onClick={() => setControlsOpen(true)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800">
              QA controls
            </button>
          </div>
        ) : undefined
      }>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {!error && originalCaseRecord && (
        <>
          <ProgressModal isLoading={isProcessing} />
          <div className="flex h-full min-h-0 flex-col">
            <div
              data-slot="qa-chat-viewport"
              role="region"
              aria-label="QA conversation"
              tabIndex={0}
              className="min-h-24 w-full flex-1 overflow-y-auto rounded-lg border border-gray-300 bg-gray-50 p-0.5 [@media(max-height:500px)]:min-h-10 dark:border-gray-700 dark:bg-white/5 md:p-4">
              {chatData &&
                chatData.map((interaction, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-2 md:grid-cols-3 gap-1">
                    <div className="col-start-1 col-span-1 m-2"></div>
                    <>
                      <div className="mr-2 col-start-2 md:col-span-2 w-fit text-xs place-self-end flex flex-col">
                        <div>
                          <span className="text-right">{account?.name}</span>
                        </div>
                        <span className="text-gray-500 italic">
                          {interaction.date.toLocaleString()}
                        </span>
                      </div>
                      <div className="col-span-2 sm:col-start-2 sm:col-span-2 place-items-end">
                        <div className="w-fit bg-blue-600/50 rounded-xl px-6 py-2 shadow-md">
                          <p className="w-fit md:text-lg text-base">
                            {interaction.question}
                          </p>
                        </div>
                      </div>
                      {index === (chatData?.length ?? 1) - 1 && (
                        <div ref={bottomRef} />
                      )}
                    </>

                    {interaction.responses &&
                      interaction.responses.length > 0 && (
                        <>
                          <div className="col-span-2 row-span-2 md:col-span-3 md:row-span-5" />
                          <div className="w-fit ml-2 text-xs flex flex-col">
                            <span>AIMIE</span>
                            <span className="ml-1 text-gray-500 italic">
                              {interaction.swapRoles ? '(opposition pov)' : ''}
                            </span>
                            {interaction.responses.length > 0 ? (
                              <span className="text-gray-500 italic">
                                {interaction.responses?.[0]?.date.toLocaleString()}
                              </span>
                            ) : (
                              ''
                            )}
                          </div>
                          <div className="md:col-start-1 col-span-2 mb-7">
                            <div className="w-fit bg-pink-600/50 rounded-xl m-2 py-2 px-6 md:text-lg text-base shadow-md">
                              {interaction.responses?.map((resp, idx) => (
                                <div key={idx}>
                                  <Markdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                      a(props) {
                                        const { ...rest } = props;
                                        return (
                                          <a
                                            {...rest}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="dark:text-white underline"
                                          />
                                        );
                                      },
                                      ol({ children, ...rest }) {
                                        return (
                                          <ol
                                            className="list-decimal ml-8 my-2"
                                            {...rest}>
                                            {children}
                                          </ol>
                                        );
                                      },
                                    }}>
                                    {resp.document}
                                  </Markdown>
                                  <div className="mt-2">
                                    {resp.exhibits &&
                                      resp.exhibits.length > 0 && (
                                        <div>
                                          <strong>References:</strong>
                                          <ul className="list-disc list-inside">
                                            {resp.exhibits.map(
                                              (exhibit, exhibitIdx) => (
                                                <li key={exhibitIdx}>
                                                  <a
                                                    href={exhibit.doc.sourceUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="dark:text-white underline">
                                                    {exhibitIdx + 1}
                                                  </a>
                                                  {exhibit.doc.pages &&
                                                    exhibit.doc.pages.length >
                                                    0 && (
                                                      <span>
                                                        {' '}
                                                        (Pages:{' '}
                                                        {exhibit.doc.pages
                                                          .map((page) => page)
                                                          .join(', ')}
                                                        )
                                                      </span>
                                                    )}
                                                </li>
                                              ),
                                            )}
                                          </ul>
                                        </div>
                                      )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                  </div>
                ))}
            </div>
            <div data-slot="qa-composer" className="z-10 min-h-24 overflow-y-auto [@media(max-height:500px)]:min-h-10">
              <form
                className={
                  'bg-background sm:pt-4 pt-1 [@media(max-height:500px)]:!pt-1 xl:px-4 w-full border-t border-gray-300'
                }
                onSubmit={(event) => handleSubmit(event)}>
                <div className="w-full">
                  <textarea
                    id="requestText"
                    name="requestText"
                    className="sm:min-h-[100px] [@media(max-height:500px)]:!min-h-0 disabled:cursor-not-allowed block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
                    rows={2}
                    required
                    onKeyDown={invokeFormSubmit}
                    disabled={isProcessing}
                    placeholder="Enter your QA comments here. Press Enter to submit. Press Shift + Enter for new line."></textarea>
                </div>
                <div className="flex justify-end gap-2 px-2 py-2">
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-gray-400 dark:bg-blue-500 dark:shadow-none dark:hover:bg-blue-600 dark:focus-visible:outline-blue-500">
                    Submit
                  </button>
                </div>
              </form>
            </div>
          </div>
          <Dialog open={controlsOpen} onClose={setControlsOpen} className="relative z-100">
            <DialogBackdrop
              transition
              className="fixed inset-0 bg-gray-500/75 transition-opacity duration-500 ease-in-out data-closed:opacity-0 dark:bg-gray-900/50"
            />
            <div className="fixed inset-0 overflow-hidden">
              <div className="absolute inset-0 overflow-hidden">
                <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
                  <DialogPanel
                    data-slot="qa-controls-panel"
                    transition
                    className="pointer-events-auto w-screen max-w-md transform transition duration-500 ease-in-out data-closed:translate-x-full sm:duration-700">
                    <div className="flex h-full flex-col overflow-y-auto bg-white py-6 shadow-xl dark:bg-gray-800">
                      <div className="flex items-start justify-between px-4 sm:px-6">
                        <DialogTitle className="text-base font-semibold text-gray-900 dark:text-white">
                          QA controls
                        </DialogTitle>
                        <button
                          type="button"
                          onClick={() => setControlsOpen(false)}
                          aria-label="Close QA controls"
                          className="rounded-md text-gray-500 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:text-gray-300 dark:hover:text-white">
                          <XMarkIcon aria-hidden="true" className="size-6" />
                        </button>
                      </div>
                      <div className="mt-6 flex-1 space-y-6 px-4 sm:px-6">
                        <section>
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Response Verbosity Level</h3>
                          {controlVerbosity ? (
                            <SelectionList
                              labelText=""
                              options={verbosityOptions}
                              onChange={(option) => setVerbosityLevel(option.value)}
                              defaultOption={verbosityOptions.find((option) => option.value === verbosityLevel)}
                            />
                          ) : (
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Verbosity control is not available.</p>
                          )}
                        </section>
                        <section>
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">AIMIE&apos;s Perspective</h3>
                          {swapRolesControl ? (
                            <div className="mt-3 flex items-center gap-3">
                              <Slider isActive={swapRoles} onToggle={setSwapRoles} />
                              <span className="text-sm text-gray-500 dark:text-gray-300">
                                {swapRoles
                                  ? "AIMIE will answer from the opposition's perspective"
                                  : 'AIMIE will answer from your perspective'}
                              </span>
                            </div>
                          ) : (
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Perspective control is not available.</p>
                          )}
                        </section>
                        <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-6 dark:border-gray-700">
                          <button
                            type="button"
                            onClick={() => {
                              exportChatAsDocx(`ProBonoLaw_Case_${caseId}_QA_Chat_Export`);
                            }}
                            disabled={isProcessing || chatData.length === 0}
                            className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-400 hover:bg-green-500">
                            Export Chat
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              clearChatData();
                              setSessionId(crypto.randomUUID());
                              setControlsOpen(false);
                            }}
                            disabled={isProcessing}
                            className="rounded-md bg-gray-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-400 hover:bg-gray-500">
                            Reset
                          </button>
                        </div>
                      </div>
                    </div>
                  </DialogPanel>
                </div>
              </div>
            </div>
          </Dialog>
        </>
      )}
      {!!caseId && !loading && !error && !originalCaseRecord && (
        <p>No data available.</p>
      )}
    </CasePageTemplate>
  );
}
