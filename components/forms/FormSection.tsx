import { cn } from '@/lib/cssHelper';
import type { ReactNode } from 'react';

type FormSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  fieldsClassName?: string;
  id?: string;
};

export function FormSection({
  title,
  description,
  children,
  className,
  fieldsClassName,
  id,
}: FormSectionProps) {
  return (
    <section
      id={id}
      className={cn(
        'grid grid-cols-1 gap-x-8 gap-y-6 border-b border-gray-900/10 pb-10 md:grid-cols-3 dark:border-white/10',
        className,
      )}>
      <div>
        <h2 className="text-base/7 font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm/6 text-gray-600 dark:text-gray-400">
            {description}
          </p>
        )}
      </div>
      <div
        className={cn(
          'min-w-0 max-w-2xl md:col-span-2',
          fieldsClassName ??
            'grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6',
        )}>
        {children}
      </div>
    </section>
  );
}

export function FormActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3">
      <div
        className={cn(
          'flex flex-wrap items-center justify-end gap-3 pt-6 md:col-span-2 md:col-start-2',
          className,
        )}>
        {children}
      </div>
    </div>
  );
}
