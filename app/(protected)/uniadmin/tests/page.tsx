'use client';
import { useTransitionRouter } from 'next-view-transitions';

import { useEffect } from 'react';

export default function TestsRedirect() {
  const router = useTransitionRouter();
  useEffect(() => { router.replace('/uniadmin/create-test'); }, [router]);
  return (
    <div className="flex items-center justify-center h-64">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );
}