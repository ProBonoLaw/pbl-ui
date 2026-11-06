'use client';
import { logger } from "@/lib/logger";
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';

const ProxiedIFrame = ({
  src,
  caseId,
  fillHeight = false,
  title = 'Authenticated Content',
}: {
  src: string;
  caseId: string;
  fillHeight?: boolean;
  title?: string;
}) => {
  const { fetchWithAuth } = useAuth();
  const [proxySourceId, setProxySourceId] = useState<string>('');

  // The iframe src points to your proxy route, passing the target URL as a query param
  const proxySrc = `/api/accounts/cases/${caseId}/sharepoint-proxy?url=${encodeURIComponent(src)}`;

  useEffect(() => {
    const validateSrc = async () => {
      try {
        const response = await fetchWithAuth(proxySrc, {
          method: 'GET', // Use GET to check if the URL is accessible with auth
        });
        const data = await response.json(); // Expecting a JSON response with { success: boolean }
        if (!response.ok) {
          throw new Error(
            `Proxy validation failed: ${data.error || 'Unknown error'}`,
          );
        }
        const { previewUrl } = data ?? {};
        if (typeof previewUrl !== 'string' || previewUrl.trim() === '') {
          throw new Error(
            'Proxy validation failed: missing or invalid previewUrl',
          );
        }
        logger.info('Proxy validation succeeded, loading iframe.');
        setProxySourceId(previewUrl); // Set the proxy URL to load in the iframe
      } catch (error) {
        logger.error('Error validating iframe source:', error);
      }
    };
    validateSrc();
  }, [proxySrc, fetchWithAuth]);

  return proxySourceId !== '' ? (
    <>
      <iframe
        src={proxySourceId} // Load the proxy URL if validation succeeded, otherwise load a blank page
        title={title}
        width="100%"
        className={fillHeight ? 'min-h-0 flex-1' : 'min-h-[72dvh]'}
        allow="none"
        frameBorder="0"
        sandbox="allow-same-origin allow-scripts allow-forms"
      />
    </>
  ) : (
    <div className={fillHeight
      ? 'flex min-h-0 w-full flex-1 items-center justify-center bg-gray-100 text-gray-500'
      : 'flex h-[72dvh] w-full items-center justify-center bg-gray-100 text-gray-500'}>
      Loading...
    </div>
  );
};

export default ProxiedIFrame;
