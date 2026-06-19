'use client';

import { useReportWebVitals } from 'next/web-vitals';

export default function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    const body = JSON.stringify({
      id: metric.id,
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      navigationType: metric.navigationType,
      path: window.location.pathname,
      recordedAt: Date.now(),
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/metrics/web-vitals', new Blob([body], { type: 'application/json' }));
    } else {
      void fetch('/api/metrics/web-vitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      });
    }
  });
  return null;
}
