import ReactMarkdown from 'react-markdown';
import DecorativePageBackground from '@/components/DecorativePageBackground';

export default function LegalDocumentPage({ document }: { readonly document: { title: string; version: string; lastModified: string; markdown: string } }) {
  return (
    <main className="relative isolate w-full px-6 py-16 text-gray-800 dark:text-gray-200">
      <DecorativePageBackground />
      <article className="mx-auto w-full max-w-5xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-gray-800 sm:p-10">
        <header className="border-b border-gray-200 pb-5 dark:border-white/10">
          <h1 className="text-3xl font-semibold text-gray-950 dark:text-white">{document.title}</h1>
          <p className="mt-2 text-sm">Version {document.version} · Last Modified {document.lastModified}</p>
        </header>
        <div className="mt-6 space-y-4 whitespace-pre-wrap text-sm leading-6"><ReactMarkdown>{document.markdown}</ReactMarkdown></div>
      </article>
    </main>
  );
}
