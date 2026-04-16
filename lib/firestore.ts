// Shared Firestore types — db instance is exported from '@/lib/firebase'
export interface UserProfile {
  email: string;
  role: 'super_admin' | 'university_admin' | 'student';
  createdAt: Date;
  universityId?: string;
  name?: string;
}