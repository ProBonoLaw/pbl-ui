import { msalInstance } from '@/lib/msal';
import type { WebPubSubLike } from '@/lib/types';
import type { IPublicClientApplication } from '@azure/msal-browser';
import { WebPubSubClient } from '@azure/web-pubsub-client';

export type WebPubSubClientFactory = (options: {
  getClientAccessUrl: () => Promise<string>;
}) => WebPubSubLike;

export interface RuntimeDependencies {
  msalClient: IPublicClientApplication;
  createWebPubSubClient: WebPubSubClientFactory;
}

export type RuntimeDependencyOverrides = Partial<RuntimeDependencies>;

declare global {
  interface Window {
    __PB_RUNTIME_DEPENDENCIES__?: RuntimeDependencyOverrides;
  }

  var __PB_RUNTIME_DEPENDENCIES__: RuntimeDependencyOverrides | undefined;
}

const defaultDependencies: RuntimeDependencies = {
  msalClient: msalInstance,
  createWebPubSubClient: (options) =>
    new WebPubSubClient(options) as unknown as WebPubSubLike,
};

export function getRuntimeDependencies(): RuntimeDependencies {
  const overrides =
    (typeof window !== 'undefined'
      ? window.__PB_RUNTIME_DEPENDENCIES__
      : globalThis.__PB_RUNTIME_DEPENDENCIES__) ?? {};

  return {
    ...defaultDependencies,
    ...overrides,
  };
}
