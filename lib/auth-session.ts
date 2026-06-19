const AUTH_SESSION_HINT_KEY = 'uniship-auth-session';

/**
 * This is only a performance hint that decides whether public routes should
 * initialize Firebase Auth. It is not an authorization or authentication
 * mechanism.
 */
export function hasAuthSessionHint(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(AUTH_SESSION_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

export function setAuthSessionHint(present: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (present) window.localStorage.setItem(AUTH_SESSION_HINT_KEY, '1');
    else window.localStorage.removeItem(AUTH_SESSION_HINT_KEY);
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}
