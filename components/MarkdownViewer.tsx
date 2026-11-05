import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function MarkdownViewer({ markdown }: { markdown: string }) {
  return (
    <div className="max-h-[50rem] overflow-auto rounded-md bg-gray-50 p-4 dark:bg-white/5">
      <div className="max-w-none text-sm leading-6 text-gray-900 dark:text-gray-100">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1({ children, ...props }) {
              return (
                <h1 className="mb-4 text-3xl font-bold" {...props}>
                  {children}
                </h1>
              );
            },
            h2({ children, ...props }) {
              return (
                <h2 className="mb-3 mt-8 text-2xl font-bold" {...props}>
                  {children}
                </h2>
              );
            },
            h3({ children, ...props }) {
              return (
                <h3 className="mb-2 mt-6 text-xl font-semibold" {...props}>
                  {children}
                </h3>
              );
            },
            h4({ children, ...props }) {
              return (
                <h4 className="mb-2 mt-5 text-lg font-semibold" {...props}>
                  {children}
                </h4>
              );
            },
            p({ children, ...props }) {
              return (
                <p className="my-3" {...props}>
                  {children}
                </p>
              );
            },
            ul({ children, ...props }) {
              return (
                <ul className="my-3 list-disc space-y-1 pl-6" {...props}>
                  {children}
                </ul>
              );
            },
            ol({ children, ...props }) {
              return (
                <ol className="my-3 list-decimal space-y-1 pl-6" {...props}>
                  {children}
                </ol>
              );
            },
            li({ children, ...props }) {
              return <li {...props}>{children}</li>;
            },
            a({ href, children, ...props }) {
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  {...props}>
                  {children}
                </a>
              );
            },
            table({ children, ...props }) {
              return (
                <div className="my-4 overflow-x-auto">
                  <table
                    className="w-full border-collapse text-left"
                    {...props}>
                    {children}
                  </table>
                </div>
              );
            },
            th({ children, ...props }) {
              return (
                <th
                  className="border border-gray-300 bg-gray-100 px-3 py-2 font-semibold dark:border-gray-600 dark:bg-gray-800"
                  {...props}>
                  {children}
                </th>
              );
            },
            td({ children, ...props }) {
              return (
                <td
                  className="border border-gray-300 px-3 py-2 align-top dark:border-gray-600"
                  {...props}>
                  {children}
                </td>
              );
            },
            pre({ children, ...props }) {
              return (
                <pre
                  className="my-4 overflow-x-auto rounded bg-gray-900 p-3 text-gray-100"
                  {...props}>
                  {children}
                </pre>
              );
            },
          }}>
          {markdown}
        </ReactMarkdown>
      </div>
    </div>
  );
}
