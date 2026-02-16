import { getFirestore } from 'firebase/firestore';
import app from './firebase';

export const db = getFirestore(app);

export interface UserProfile {
  email: string;
  role: 'superadmin' | 'uniadmin' | 'user';
  createdAt: Date;
  universityId?: string; // For uniadmin
  name?: string;
}