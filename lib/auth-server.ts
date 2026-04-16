import { getAdminAuth } from '@/lib/firebase-admin';
import { headers } from 'next/headers';

export interface AuthUser {
  uid: string;
  email?: string;
}

/**
 * Verify Firebase ID token from the Authorization header.
 * Use in API routes. Returns the decoded user or null.
 */
export async function verifyAuthFromRequest(request: Request): Promise<AuthUser | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const idToken = authHeader.slice(7);
  if (!idToken) return null;

  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}

/**
 * Verify Firebase ID token from cookies/headers in server actions.
 * Server actions don't have a Request object — use next/headers.
 */
export async function verifyAuthFromHeaders(): Promise<AuthUser | null> {
  try {
    const headerList = await headers();
    const authHeader = headerList.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;

    const idToken = authHeader.slice(7);
    if (!idToken) return null;

    const decoded = await getAdminAuth().verifyIdToken(idToken);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}
