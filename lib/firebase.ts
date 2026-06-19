import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseApp } from '@/lib/firebase-app';

const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

export { firebaseApp as app, auth, db };
