'use client';

import { useEffect, useState } from 'react';
import { SiteHeader } from '@/components/SiteHeader';

export function AppShellHeader() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <SiteHeader />;
}
