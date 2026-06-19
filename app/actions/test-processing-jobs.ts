'use server';

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb, getAdminStorage } from '@/lib/firebase-admin';

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export async function queueTestDocument(formData: FormData) {
  try {
    const file = formData.get('file');
    const idToken = String(formData.get('idToken') ?? '');
    if (!(file instanceof File)) throw new Error('No document uploaded.');
    if (!idToken) throw new Error('Authentication is required.');
    if (file.size > MAX_DOCUMENT_BYTES) throw new Error('Document must be 10 MB or smaller.');

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf' && ext !== 'docx') throw new Error('Only PDF and DOCX documents are supported.');

    const decoded = await getAdminAuth().verifyIdToken(idToken);
    const db = getAdminDb();
    const userSnap = await db.collection('users').doc(decoded.uid).get();
    const profile = userSnap.data();
    if (!profile || (profile.role !== 'university_admin' && profile.role !== 'super_admin')) {
      throw new Error('Only university administrators can queue test documents.');
    }

    const universityId = String(formData.get('universityId') ?? '');
    if (!universityId || (profile.role !== 'super_admin' && profile.universityId !== universityId)) {
      throw new Error('University scope does not match your account.');
    }

    const jobRef = db.collection('test_processing_jobs').doc();
    const storagePath = `test_processing/${decoded.uid}/${jobRef.id}/${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    await getAdminStorage().bucket().file(storagePath).save(bytes, {
      contentType: file.type || (ext === 'docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/pdf'),
      resumable: false,
      metadata: { cacheControl: 'private, no-store' },
    });

    await jobRef.set({
      status: 'queued',
      createdAt: FieldValue.serverTimestamp(),
      createdBy: decoded.uid,
      universityId,
      storagePath,
      sourceFileName: file.name,
      contentType: file.type || null,
      title: String(formData.get('title') ?? '').trim(),
      description: String(formData.get('description') ?? '').trim(),
      duration: Number(formData.get('duration') ?? 60),
      examStart: String(formData.get('examStart') ?? ''),
      examEnd: String(formData.get('examEnd') ?? ''),
      allowReattempts: String(formData.get('allowReattempts')) === 'true',
    });

    return { success: true, jobId: jobRef.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to queue document processing.',
    };
  }
}
