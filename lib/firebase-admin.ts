import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

let app: App;
let adminAuth: Auth;

function getAdminApp(): App {
  if (!app) {
    const existing = getApps();
    if (existing.length > 0) {
      app = existing[0];
    } else {
      // Use GOOGLE_APPLICATION_CREDENTIALS env var (preferred),
      // or fall back to individual env vars for Firebase Hosting / Cloud Functions.
      const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

      if (clientEmail && privateKey && projectId) {
        app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
      } else {
        // On Firebase Hosting / Cloud Functions, default credentials are available
        app = initializeApp();
      }
    }
  }
  return app;
}

export function getAdminAuth(): Auth {
  if (!adminAuth) {
    adminAuth = getAuth(getAdminApp());
  }
  return adminAuth;
}
