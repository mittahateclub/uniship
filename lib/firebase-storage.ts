import { getStorage } from 'firebase/storage';
import { firebaseApp } from '@/lib/firebase-app';

export const storage = getStorage(firebaseApp);
