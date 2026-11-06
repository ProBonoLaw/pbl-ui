import { TriangleAlert } from 'lucide-react';

export default function AiOutputNotice() {
  return (
    <div
      role="note"
      aria-label="AI output warning"
      className="flex w-full items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950 shadow-sm dark:border-amber-500/40 dark:bg-amber-950/90 dark:text-amber-100">
      <TriangleAlert aria-hidden="true" className="size-5 shrink-0" />
      <span>AI-generated. May be inaccurate. Verify before relying on outputs.</span>
    </div>
  );
}
