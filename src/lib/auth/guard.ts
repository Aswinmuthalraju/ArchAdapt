/**
 * The only place that decides where a visitor may be. Pure, so it is unit tested.
 * Pages never compare sessions or guests themselves; they ask this module.
 */

export type AuthStatus = 'loading' | 'anonymous' | 'guest' | 'authenticated';

export const AUTH_PAGES = ['/login', '/register'];
export const PROTECTED_PREFIXES = ['/dashboard', '/workspace'];
const DEFAULT_NEXT = '/dashboard';

export function statusForUser<T extends { isGuest?: boolean }>(user: T | null): Exclude<AuthStatus, 'loading'> {
  if (!user) return 'anonymous';
  return user.isGuest ? 'guest' : 'authenticated';
}

const isProtected = (path: string) => PROTECTED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
const isAuthPage = (path: string) => AUTH_PAGES.includes(path);

/** A same-site path to return to after signing in. Anything else (other origins, auth pages) becomes the dashboard. */
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return DEFAULT_NEXT;
  const path = value.split(/[?#]/)[0];
  return isAuthPage(path) ? DEFAULT_NEXT : value;
}

/**
 * Where to send the visitor from `path`, or null to stay. Never redirects while the session is loading,
 * and the targets are chosen so that applying this twice always settles.
 */
export function authRedirect(status: AuthStatus, path: string, next: string = DEFAULT_NEXT): string | null {
  if (status === 'loading') return null;
  if (status === 'anonymous' && isProtected(path)) return `/login?next=${encodeURIComponent(path)}`;
  if ((status === 'guest' || status === 'authenticated') && isAuthPage(path)) return safeNext(next);
  return null;
}
