'use client';
import { useState, type CSSProperties } from 'react';
import Image from 'next/image';
import type { Club } from '../../packages/shared/src/types';

export function ClubBadge({ club, size = 'normal' }: { club: Club; size?: string }) {
  const [failedPath, setFailedPath] = useState('');
  const path = club.logo?.path;
  const showImage = !!path && path !== failedPath;
  return (
    <span
      className={`club-badge ${size} ${showImage ? 'with-logo' : ''}`}
      style={{ '--club': club.color } as CSSProperties}
      title={club.name}
    >
      {showImage ? (
        <Image
          src={path}
          alt={`${club.name} 로고`}
          width={72}
          height={72}
          unoptimized
          onError={() => setFailedPath(path)}
        />
      ) : (
        <span aria-label={`${club.name} 구단 약칭`}>{club.short}</span>
      )}
    </span>
  );
}
