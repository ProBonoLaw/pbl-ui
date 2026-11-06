'use client';
import { logger } from "@/lib/logger";
import type { Notice } from '@/lib/types';

import { useEffect } from 'react';

type EventMap = {
  'notify:new': {
    id: string;
    notificationType: string;
    createdAt: Date;
    oid: string;
    accountId?: string;
    status?: string;
    errorMessage?: string;
    /** The complete PubSub notice, when this event originated in real time. */
    notice?: Notice;
  };
  'notify:read': { id: string; notificationType: string };
  'photo:updated': { photoUrl: string };
  'notify:deleted': { id: string; notificationType: string };
};

export function emitNotification<K extends keyof EventMap>(
  type: K,
  detail: EventMap[K],
) {
  try {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  } catch (error) {
    logger.error('Error emitting event:', error);
  }
}

export function useEventHandler<K extends keyof EventMap>(
  type: K,
  handler: (detail: EventMap[K]) => void,
) {
  useEffect(() => {
    const onEvent = (e: Event) => {
      handler((e as CustomEvent<EventMap[K]>).detail);
    };
    window.addEventListener(type as string, onEvent as EventListener);

    return () => {
      window.removeEventListener(type as string, onEvent as EventListener);
    };
  }, [type, handler]);
}
