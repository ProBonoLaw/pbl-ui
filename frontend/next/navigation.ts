import { useMemo } from 'react';
import { useLocation, useNavigate, useParams as useRouteParams } from 'react-router-dom';

function navigationHref(href: string) {
  return href.startsWith('#') ? window.location.pathname + window.location.search + href : href;
}

export function useRouter() {
  const navigate = useNavigate();
  return useMemo(() => ({
    push: (href: string, options?: { scroll?: boolean }) => navigate(navigationHref(href), { state: { preventScrollReset: options?.scroll === false } }),
    replace: (href: string, options?: { scroll?: boolean }) => navigate(navigationHref(href), { replace: true, state: { preventScrollReset: options?.scroll === false } }),
    back: () => navigate(-1),
    forward: () => navigate(1),
    refresh: () => window.location.reload(),
    prefetch: () => Promise.resolve(),
  }), [navigate]);
}

export function usePathname() { return useLocation().pathname; }
export function useSearchParams() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}
export function useSelectedLayoutSegments() {
  return usePathname().split('/').filter(Boolean);
}
export const useParams = useRouteParams;
