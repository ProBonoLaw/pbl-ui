import { LoaderCircleIcon } from 'lucide-react';
import { cn } from '@/lib/cssHelper';

export default function LoadingState({
  title = 'Loading',
  message,
  className,
  fullHeight = false,
}: Readonly<{
  title?: string;
  message?: string;
  className?: string;
  fullHeight?: boolean;
}>) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex w-full flex-col items-center justify-center gap-3 text-center text-slate-700 dark:text-slate-200',
        fullHeight ? 'min-h-[45vh]' : 'py-10',
        className,
      )}>
      <LoaderCircleIcon
        aria-hidden="true"
        className="size-9 animate-spin text-blue-600 dark:text-blue-400"
      />
      <div className="text-base font-semibold">{title}</div>
      {message && (
        <div className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
          {message}
        </div>
      )}
    </div>
  );
}
