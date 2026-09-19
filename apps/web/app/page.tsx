'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchCurrentUser } from '../lib/api-client';

/**
 * Redirect into the real auth flow — see /docs/DEVELOPMENT-PHASES.md.
 *
 * Phase 10: with tokens in an httpOnly cookie, client JS can no longer
 * check "is there a token" synchronously (that's the point). Instead
 * this asks the API directly (cookie sent automatically) and routes
 * based on whether that succeeds.
 */
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    fetchCurrentUser()
      .then(() => router.replace('/dashboard'))
      .catch(() => router.replace('/login'));
  }, [router]);

  return null;
}
