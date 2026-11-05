'use client';

import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { EllipsisVerticalIcon } from '@heroicons/react/20/solid';
import Link from 'next/link';
import type { ReactNode } from 'react';

export type ListAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
};

export type BadgeTone = 'gray' | 'blue' | 'green' | 'yellow' | 'orange' | 'red';

export function statusTone(status: string): BadgeTone {
  const value = status.toLowerCase();
  if (['completed', 'complete', 'success', 'successful', 'active'].includes(value)) return 'green';
  if (['failed', 'failure', 'error', 'overdue'].includes(value)) return 'red';
  if (['pending', 'started', 'in progress', 'processing'].includes(value)) return 'yellow';
  return 'gray';
}

const badgeClasses: Record<BadgeTone, string> = {
  gray: 'bg-gray-50 text-gray-600 ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-300 dark:ring-gray-400/20',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/20',
  green: 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-400/10 dark:text-green-400 dark:ring-green-500/20',
  yellow: 'bg-yellow-50 text-yellow-800 ring-yellow-600/20 dark:bg-yellow-400/10 dark:text-yellow-500 dark:ring-yellow-400/20',
  orange: 'bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-400/10 dark:text-orange-400 dark:ring-orange-400/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-400/10 dark:text-red-400 dark:ring-red-400/20',
};

export function StatusBadge({ children, tone = 'gray' }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={`inline-flex shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${badgeClasses[tone]}`}>{children}</span>;
}

export function StackedList({ children, isLoading = false, isEmpty = false, emptyMessage = 'No items found.' }: {
  children: ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
}) {
  return (
    <ul role="list" className="divide-y divide-gray-100 dark:divide-white/10">
      {isLoading ? <li role="status" className="py-5 text-sm text-gray-500 dark:text-gray-400">Loading...</li>
        : isEmpty ? <li className="py-5 text-sm text-gray-500 dark:text-gray-400">{emptyMessage}</li>
          : children}
    </ul>
  );
}

export function ListActionMenu({ actions, label }: { actions: ListAction[]; label: string }) {
  const availableActions = actions.filter((action) => !action.disabled);
  if (availableActions.length === 0) return null;

  return (
    <Menu as="div" className="relative flex-none">
      <MenuButton aria-label={label} className="relative rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white">
        <EllipsisVerticalIcon aria-hidden="true" className="size-5" />
      </MenuButton>
      <MenuItems anchor="bottom end" transition className="z-30 w-44 origin-top-right rounded-md bg-white py-1 shadow-lg outline-1 outline-gray-900/5 transition data-closed:scale-95 data-closed:opacity-0 data-enter:duration-100 data-leave:duration-75 dark:bg-gray-800 dark:outline-white/10">
        {availableActions.map((action) => (
          <MenuItem key={action.label}>
            {action.href ? (
              <Link href={action.href} className="block px-3 py-2 text-sm text-gray-900 data-focus:bg-gray-50 dark:text-white dark:data-focus:bg-white/10">{action.label}</Link>
            ) : (
              <button type="button" onClick={action.onClick} className="block w-full px-3 py-2 text-left text-sm text-gray-900 data-focus:bg-gray-50 dark:text-white dark:data-focus:bg-white/10">{action.label}</button>
            )}
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}

export function PrimaryListLink({ href, children, onClick }: { href: string; children: ReactNode; onClick?: () => void }) {
  return <Link href={href} onClick={onClick} className="inline-flex shrink-0 items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-white/10 dark:text-white dark:shadow-none dark:ring-white/10 dark:hover:bg-white/20">{children}</Link>;
}

export function StackedListItem({
  title,
  badge,
  description,
  metadata = [],
  primaryAction,
  menuActions = [],
  menuLabel = 'Open options',
  className = '',
}: {
  title: ReactNode;
  badge?: ReactNode;
  description?: ReactNode;
  metadata?: ReactNode[];
  primaryAction?: ReactNode;
  menuActions?: ListAction[];
  menuLabel?: string;
  className?: string;
}) {
  return (
    <li className={`flex flex-col items-stretch justify-between gap-x-4 gap-y-3 py-5 sm:flex-row sm:items-center ${className}`}>
      <div className="flex min-w-0 items-start gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
            <p className="min-w-0 line-clamp-2 text-sm/6 font-semibold text-gray-900 dark:text-white">{title}</p>
            {badge}
          </div>
          {description && <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">{description}</p>}
          {metadata.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs/5 text-gray-500 dark:text-gray-400">
              {metadata.map((item, index) => (
                <span key={index} className="min-w-0 truncate">
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {(primaryAction || menuActions.length > 0) && (
        <div className="flex flex-none items-center justify-end gap-x-2 sm:gap-x-4">
          {primaryAction}
          <ListActionMenu actions={menuActions} label={menuLabel} />
        </div>
      )}
    </li>
  );
}
