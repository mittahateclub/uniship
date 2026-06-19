import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminDb, getAdminStorage } from '@/lib/firebase-admin';
import { verifyAuthFromRequest } from '@/lib/auth-server';
import { processTestFile } from '@/app/actions/process-test';

export const runtime = 'nodejs';
export const maxDuration = 300;

async function claimJob(jobId?: string) {
  const db = getAdminDb();
  const candidate = jobId
    ? db.collection('test_processing_jobs').doc(jobId)
    : (await db.collection('test_processing_jobs')
        .where('status', '==', 'queued')
        .orderBy('createdAt', 'asc')
        .limit(1)
        .get()).docs[0]?.ref;
  if (!candidate) return null;

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(candidate);
    if (!snapshot.exists || snapshot.data()?.status !== 'queued') return null;
    transaction.update(candidate, {
      status: 'processing',
      startedAt: FieldValue.serverTimestamp(),
      leaseUntil: Timestamp.fromMillis(Date.now() + 5 * 60_000),
    });
    return { ref: candidate, data: snapshot.data()! };
  });
}

async function processOne(jobId?: string) {
  const claimed = await claimJob(jobId);
  if (!claimed) return { processed: false };

  const { ref, data } = claimed;
  const bucketFile = getAdminStorage().bucket().file(data.storagePath);
  try {
    const [buffer] = await bucketFile.download();
    const file = new File([new Uint8Array(buffer)], data.sourceFileName, {
      type: data.contentType || 'application/pdf',
    });
    const result = await processTestFile(file);
    if (!result.success) throw new Error(result.error || 'Document processing failed.');

    const testRef = await getAdminDb().collection('tests').add({
      title: data.title || result.sourceFileName?.replace(/\.(pdf|docx)$/i, '') || 'Untitled Test',
      description: data.description || '',
      duration: data.duration || 60,
      category: 'General',
      totalQuestions: result.totalQuestionCount,
      examStart: data.examStart,
      examEnd: data.examEnd,
      metadata: result.metadata,
      sections: result.sections,
      problems: result.codingProblems,
      universityId: data.universityId,
      createdBy: data.createdBy,
      createdAt: FieldValue.serverTimestamp(),
      sourceFileName: result.sourceFileName,
      approved: false,
      allowReattempts: data.allowReattempts === true,
    });

    await ref.update({
      status: 'completed',
      completedAt: FieldValue.serverTimestamp(),
      testId: testRef.id,
      totalQuestionCount: result.totalQuestionCount,
      leaseUntil: FieldValue.delete(),
    });
    return { processed: true, jobId: ref.id, testId: testRef.id };
  } catch (error) {
    await ref.update({
      status: 'failed',
      failedAt: FieldValue.serverTimestamp(),
      error: error instanceof Error ? error.message.slice(0, 1000) : 'Unknown processing error',
      leaseUntil: FieldValue.delete(),
    });
    return { processed: true, jobId: ref.id, failed: true };
  } finally {
    await bucketFile.delete({ ignoreNotFound: true }).catch(() => {});
  }
}

function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await processOne());
}

export async function POST(request: Request) {
  const user = await verifyAuthFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { jobId } = await request.json() as { jobId?: string };
  if (!jobId) return NextResponse.json({ error: 'jobId is required' }, { status: 400 });

  const job = await getAdminDb().collection('test_processing_jobs').doc(jobId).get();
  if (!job.exists || job.data()?.createdBy !== user.uid) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }
  return NextResponse.json(await processOne(jobId));
}
