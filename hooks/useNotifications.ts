import { logger } from "@/lib/logger";
import { emitNotification, useEventHandler } from '@/lib/notificationEvents';
import { getRuntimeDependencies } from '@/lib/runtimeDependencies';
import { Notice, WebPubSubLike } from '@/lib/types';
import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';

const SCOPES = process.env.NEXT_PUBLIC_AAD_API_SCOPE!.split(',');
const NotificationIds = new Set<string>();

export function useNotifications() {
  const { fetchWithAuth } = useAuth();
  const { createWebPubSubClient } = getRuntimeDependencies();
  const [loading, setLoading] = useState<boolean>(true);

  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connected, setConnected] = useState(false);
  const [client, setClient] = useState<WebPubSubLike | null>(null);
  const [newMessage, setNewMessage] = useState<boolean | undefined>(undefined);
  const [count, setCount] = useState<number>(0);

  useEventHandler('notify:read', () => {
    if (!newMessage) {
      setNewMessage(true);
    }
  });

  useEventHandler('notify:deleted', () => {
    if (!newMessage) {
      setNewMessage(true);
    }
  });

  useEffect(() => {
    if (newMessage == false) {
      return;
    }

    (async () => {
      const res = await fetchWithAuth(
        `/api/accounts/notifications/count`,
        {
          method: 'GET',
        },
        SCOPES,
      );
      if (!res.ok) {
        logger.error(
          'Failed to fetch notification count:',
          res.status,
          res.statusText,
        );
        return;
      }
      logger.info('Rendering NotificationsChip with count:', count);
      const { count: countResponse } = await res.json();
      const numericCount = Number(countResponse);
      if (numericCount != count) {
        setCount(Number(countResponse));
      }
      if (newMessage) {
        setNewMessage(false);
      }
    })();
  }, [newMessage, fetchWithAuth, count]);

  useEffect(() => {
    if (client || isConnecting) {
      return;
    }
    setIsConnecting(true);

    logger.info(
      'Setting up WebPubSub client for notifications...',
      client,
      connected,
    );

    (async () => {
      try {
        const negotiate = async (): Promise<{
          url: string;
          groupName: string;
        }> => {
          const response = await fetchWithAuth(
            '/api/realtime/negotiate',
            { method: 'POST' },
            SCOPES,
          );

          if (!response.ok) {
            throw new Error(
              `Failed to negotiate WebPubSub connection: ${response.status} ${response.statusText}`,
            );
          }

          const negotiation = (await response.json()) as {
            url?: unknown;
            groupName?: unknown;
          };

          const { url, groupName } = negotiation;
          if (typeof url !== 'string' || typeof groupName !== 'string') {
            throw new Error('Invalid WebPubSub negotiation response');
          }

          return { url, groupName };
        };

        // Fetch the group before creating the client, then obtain a new signed
        // access URL whenever the SDK starts a new connection. Client access
        // URLs expire, so retaining one here prevents the SDK from reconnecting
        // after it has been open for a while.
        const initialNegotiation = await negotiate();
        let initialAccessUrl: string | undefined = initialNegotiation.url;

        // 1) connect (SDK uses reliable JSON protocol by default)
        const client = createWebPubSubClient({
          getClientAccessUrl: async () => {
            if (initialAccessUrl) {
              const accessUrl = initialAccessUrl;
              initialAccessUrl = undefined;
              return accessUrl;
            }

            return (await negotiate()).url;
          },
        });

        setClient(client);
        // listen for group messages BEFORE join to avoid races
        client.on('group-message', (e) => {
          try {
            // e.message.data is your JSON payload if server sent with contentType application/json
            const raw = e.message?.data;
            if (!raw) {
              return;
            }
            const isNoticePayload = (
              val: unknown,
            ): val is {
              id: string;
              notificationType: string;
              createdAt: string | Date;
              readAt: string | Date | undefined;
            } =>
              typeof val === 'object' &&
              val !== null &&
              'id' in val &&
              'notificationType' in val &&
              'createdAt' in val;

            let notice: Notice;
            if (isNoticePayload(raw)) {
              notice = raw as Notice;
              if (NotificationIds.has(notice.id)) {
                return;
              }
              setNewMessage(true);
              emitNotification('notify:new', {
                id: notice.id,
                notificationType: notice.notificationType,
                createdAt: notice.createdAt!,
                oid: notice.oid,
                accountId:
                  notice.notificationType === 'CASE_CREATED' ||
                  notice.notificationType === 'CASE_DELETED' ||
                  notice.notificationType === 'DECLARATION' ||
                  notice.notificationType === 'INGESTION' ||
                  notice.notificationType === 'EGESTION'
                    ? notice.data.accountId
                    : undefined,
                status:
                  notice.notificationType === 'CASE_CREATED' ||
                  notice.notificationType === 'CASE_DELETED' ||
                  notice.notificationType === 'DECLARATION' ||
                  notice.notificationType === 'INGESTION' ||
                  notice.notificationType === 'EGESTION'
                    ? notice.data.status
                    : undefined,
                errorMessage:
                  notice.notificationType === 'CASE_CREATED' ||
                  notice.notificationType === 'CASE_DELETED' ||
                  notice.notificationType === 'DECLARATION' ||
                  notice.notificationType === 'INGESTION' ||
                  notice.notificationType === 'EGESTION'
                    ? notice.data.errorMessage
                    : undefined,
                notice,
              });
              NotificationIds.add(notice.id);
            }
          } catch (err) {
            logger.error('Failed to parse notification message:', err);
          }
        });

        client.on('connected', () => setConnected(true));
        client.on('disconnected', () => {
          setConnected(false);
          logger.info('WebPubSub client disconnected; reconnecting');
        });
        client.on('stopped', () => {
          setConnected(false);
          setClient(null);
          logger.info('WebPubSub client stopped; creating a new client');
        });

        await client.start();

        // 2) join the declarations group (no sending from client)
        await client.joinGroup(initialNegotiation.groupName);
      } catch (error) {
        logger.error('Failed to connect WebPubSub client:', error);
        setClient(null);
      } finally {
        setIsConnecting(false);
        setLoading(false);
      }
    })();
  }, [fetchWithAuth, client, connected, isConnecting, createWebPubSubClient]);

  return { loading, count, newMessage };
}
