import localFont from 'next/font/local';
import { ViewTransitions } from 'next-view-transitions';
import ProtectedLayoutClient from './protected-layout-client';

const spaceMono = localFont({
  src: [
    { path: '../fonts/SpaceMono-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/SpaceMono-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-space-mono',
  display: 'swap',
  preload: false,
});

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ViewTransitions>
      <div className={spaceMono.variable}>
        <ProtectedLayoutClient>{children}</ProtectedLayoutClient>
      </div>
    </ViewTransitions>
  );
}
