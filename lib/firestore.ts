import { getFirestore } from 'firebase/firestore';
import app from './firebase';

export const db = getFirestore(app);

export interface UserProfile {
  email: string;
  role: 'super_admin' | 'university_admin' | 'student'; // Match firestore.rules
  createdAt: Date;
  universityId?: string;
  name?: string;
}