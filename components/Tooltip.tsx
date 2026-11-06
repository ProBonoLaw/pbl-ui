'use client';

import { cn } from '@/lib/cssHelper';
import Link from 'next/link';
import React from 'react';
import { useRef } from 'react';

type TooltipProps = {
  children: React.ReactElement<
    typeof Link & {
      className?: string;
      ref?: React.Ref<typeof Link>;
      'aria-label'?: string;
    }
  >;
  message: string;
  className?: string;
};

export default function Tooltip({
  children,
  message,
  className,
}: TooltipProps) {
  const useId = React.useId();
  const childRef = useRef<
    typeof Link & {
      className?: string;
      ref?: React.Ref<typeof Link>;
      click: () => void;
    }
  >(null);
  const uniquelyCombinedClassName = cn(
    'relative inline-block group',
    className,
  );

  return (
    <div
      id={useId}
      className={uniquelyCombinedClassName}
      tabIndex={0}
      onClick={() => childRef.current?.click()}
      aria-describedby={`${useId}-tooltip`}
      onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          childRef.current?.click();
        }
      }}>
      {React.cloneElement(children, {
        className: cn(children.props.className, 'focus-visible:ring'),
        ref: childRef,
        'aria-label': message,
      })}
      <span
        id={`${useId}-tooltip`}
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full mb-2 w-max max-w-xs
           -translate-x-1/2 translate-y-1 rounded-md bg-slate-900 px-2 py-1
           text-xs text-white opacity-0 shadow-lg transition
           group-hover:opacity-100 group-hover:translate-y-0
           group-focus-visible:opacity-100 group-focus-visible:translate-y-0">
        {message}
        <span
          className="absolute left-1/2 bottom-full -translate-x-1/2
             border-4 border-transparent border-b-slate-900"
          aria-hidden="true"></span>
      </span>
    </div>
  );
}
