'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function TestsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/uniadmin/create-test'); }, [router]);
  return (
    <div className="flex items-center justify-center h-64">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );
}