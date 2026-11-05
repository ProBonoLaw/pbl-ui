import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

type Position = [number, number];
const storageKey = 'portal-scroll-positions';

function savedPositions(): Map<string, Position> {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? '[]');
    return new Map(saved);
  } catch {
    return new Map();
  }
}

export default function ScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const positions = useRef<Map<string, Position> | null>(null);
  positions.current ??= savedPositions();

  useLayoutEffect(() => {
    const previous = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    return () => { history.scrollRestoration = previous; };
  }, []);

  useLayoutEffect(() => {
    const cache = positions.current!;
    const restored = navigationType === 'POP' ? cache.get(location.key) : undefined;
    const record = () => { cache.set(location.key, [window.scrollX, window.scrollY]); };
    const persist = () => {
      record();
      try { sessionStorage.setItem(storageKey, JSON.stringify([...cache])); } catch { /* Storage may be disabled. */ }
    };
    window.addEventListener('scroll', record, { passive: true });
    window.addEventListener('pagehide', persist);

    let hash = '';
    try { hash = decodeURIComponent(location.hash.slice(1)); } catch { /* Invalid fragments have no target. */ }
    const suppressed = navigationType !== 'POP' && location.state?.preventScrollReset === true;
    const restore = () => {
      if (suppressed) return true;
      if (restored) {
        window.scrollTo({ left: restored[0], top: restored[1], behavior: 'instant' });
        return Math.abs(window.scrollY - restored[1]) < 1;
      }
      if (hash) {
        const target = document.getElementById(hash);
        if (!target) return false;
        target.scrollIntoView({ behavior: 'instant' });
      } else {
        window.scrollTo({ left: 0, top: 0, behavior: 'instant' });
      }
      return true;
    };

    let mutation: MutationObserver | undefined;
    let resize: ResizeObserver | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      mutation?.disconnect();
      resize?.disconnect();
      if (timeout) clearTimeout(timeout);
    };
    if (!restore()) {
      // Lazy screens and fetched content may not have their final height yet.
      const retry = () => { if (restore()) stop(); };
      mutation = new MutationObserver(retry);
      mutation.observe(document.body, { childList: true, subtree: true });
      resize = new ResizeObserver(retry);
      resize.observe(document.body);
      timeout = setTimeout(stop, 10_000);
    }
    return () => {
      stop();
      window.removeEventListener('scroll', record);
      window.removeEventListener('pagehide', persist);
    };
  }, [location, navigationType]);

  return null;
}
