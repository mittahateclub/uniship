import { auth } from '@/lib/firebase';

/**
 * Get the current user's Firebase ID token for authenticated API calls.
 * Returns the token string or null if not authenticated.
 */
export async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

/**
 * Create headers object with Authorization bearer token.
 * Merges with any additional headers provided.
 */
export async function authHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const token = await getIdToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}
