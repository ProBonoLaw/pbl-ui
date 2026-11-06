import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router-dom';
import ScrollRestoration from '../../../frontend/ScrollRestoration';
import Link from '../../../frontend/next/link';
import { useRouter } from '../../../frontend/next/navigation';

function Content() {
  const { pathname } = useLocation();
  const [ready, setReady] = useState(!pathname.endsWith('/delayed'));
  useEffect(() => {
    const timeout = setTimeout(() => setReady(true), 200);
    return () => clearTimeout(timeout);
  }, []);
  return ready ? <main style={{ height: 3200 }}>
    <h1>Navigation fixture</h1>
    <h2 id="target" style={{ position: 'absolute', top: 1800, margin: 0 }}>Hash target</h2>
  </main> : <p>Loading content</p>;
}

function App() {
  const { pathname } = useLocation();
  const router = useRouter();
  return <>
    <ScrollRestoration />
    <nav style={{ position: 'fixed', top: 0, right: 0, zIndex: 1, background: 'white' }}>
      <Link href="/navigation-test/one">Normal link</Link>{' '}
      <Link href="/navigation-test/two" scroll={false}>Preserve link</Link>{' '}
      <Link href="#target">Hash link</Link>{' '}
      <Link href="#target" scroll={false}>Preserve hash</Link>{' '}
      <Link href="/navigation-test/delayed#target">Delayed hash</Link>{' '}
      <button onClick={() => router.push('/navigation-test/three', { scroll: false })}>Preserve push</button>
      <button onClick={() => router.replace('/navigation-test/four', { scroll: false })}>Preserve replace</button>
      <button onClick={() => router.push('#target', { scroll: false })}>Preserve push hash</button>
    </nav>
    <Content key={pathname} />
  </>;
}

createRoot(document.getElementById('root')!).render(<BrowserRouter><App /></BrowserRouter>);
