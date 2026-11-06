import { forwardRef, type AnchorHTMLAttributes } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean;
};

const Link = forwardRef<HTMLAnchorElement, Props>(function Link(
  { href, replace, scroll, prefetch, ...props }, ref,
) {
  const { pathname, search } = useLocation();
  // Downloads and API links must reach the origin instead of the SPA router.
  void prefetch;
  const internal = href.startsWith('/') || href.startsWith('#') || href.startsWith('?');
  if (!internal || href.startsWith('//') || href.startsWith('/api/') || props.target || props.download) {
    return <a {...props} href={href} ref={ref} />;
  }
  const destination = href.startsWith('#') ? { pathname, search, hash: href } : href;
  return <RouterLink {...props} to={destination} replace={replace} state={{ preventScrollReset: scroll === false }} ref={ref} />;
});

export default Link;
