import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'PROPETRA',
  description:
    'PROPETRA — cloud-based, multi-tenant Property Management System.',
};

/**
 * Root layout — application shell.
 *
 * Phase 1 scope only: a minimal shell proving the frontend builds and
 * runs. Navigation structure, dashboards, and module screens are
 * introduced starting in later phases per /docs/UI-UX-DIRECTION.md
 * and /docs/DEVELOPMENT-PHASES.md.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
