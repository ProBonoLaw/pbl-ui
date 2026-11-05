'use client';

import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/cssHelper';
import Link from 'next/link';

export type NotificationChipProps = {
  /** Show e.g. 99+ when count exceeds this value */
  max?: number;
  /** Hide the chip entirely when the count is 0 */
  hideWhenZero?: boolean;
  /** Visual size */
  size?: 'sm' | 'md' | 'lg';
  /** Color style */
  variant?: 'primary' | 'neutral' | 'ghost';
  /** Additional classes */
  className?: string;
  /** Accessible label override. If omitted, one is generated. */
  ariaLabel?: string;
  /** Click handler */
  onClick?: () => void;
};

const sizes = {
  sm: 'text-xs px-2 h-5',
  md: 'text-sm px-2.5 h-6',
  lg: 'text-sm px-3 h-7',
} as const;

const variants = {
  primary:
    'bg-indigo-600 text-white ring-1 ring-inset ring-indigo-500 hover:bg-indigo-500',
  neutral:
    'bg-gray-200 text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-300',
  ghost:
    'bg-transparent text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-100',
} as const;

const common =
  'inline-flex select-none items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';

export default function NotificationsChip({
  max = 99,
  size = 'md',
  variant = 'primary',
  className,
  ariaLabel,
  onClick,
}: NotificationChipProps) {
  const { loading, count } = useNotifications();

  // Display text like "99+" when exceeding max
  const display = loading ? '...' : count > max ? `${max}+` : String(count);
  const label =
    ariaLabel ?? `${count} unread notification${count === 1 ? '' : 's'}`;

  return (
    <Link
      href="/notifications"
      className={cn(common, sizes[size], variants[variant], className)}
      aria-label={label}
      onClick={onClick}>
      <span aria-hidden>{display}</span>
      <span className="sr-only">{label}</span>
    </Link>
  );
}
