'use client';
import { useState } from 'react';
export function useClubProfile() {
  const [tab, setTab] = useState('overview'),
    [applying, setApplying] = useState(false);
  return { tab, setTab, applying, setApplying };
}
