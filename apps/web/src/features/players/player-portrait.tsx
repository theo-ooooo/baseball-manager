'use client';
import { useState } from 'react';
import Image from 'next/image';
import type { Player } from '@dugout/shared/types';
import { PLAYER_SILHOUETTE, officialPortrait } from '@dugout/shared/player-portrait';

type Size = 'small' | 'large';
const dimensions: Record<Size, { width: number; height: number }> = {
  small: { width: 31, height: 34 },
  large: { width: 76, height: 90 },
};

/**
 * Player photo with a local jersey fallback.
 * The official photo is shown only when a verified official identifier exists; a missing
 * identifier, a blocked request or a load error all fall back to the bundled jersey.
 */
export function PlayerPortrait({
  player,
  size = 'small',
  showNumber = true,
}: {
  player: Pick<Player, 'name' | 'number' | 'real' | 'rating' | 'portrait'>;
  size?: Size;
  showNumber?: boolean;
}) {
  const portrait = officialPortrait(player);
  const [failedUrl, setFailedUrl] = useState('');
  const photo = portrait && portrait.url !== failedUrl ? portrait.url : '';
  const { width, height } = dimensions[size];
  return (
    <span
      className={`player-portrait ${size} ${player.real ? '' : 'generated'} ${photo ? 'with-photo' : 'silhouette'}`}
      data-portrait={photo ? portrait?.league : 'default'}
      title={photo ? `${player.name} 공식 사진` : `${player.name} 사진 없음 · 기본 유니폼`}
    >
      {photo ? (
        <Image
          src={photo}
          alt={`${player.name} 공식 사진`}
          width={width}
          height={height}
          unoptimized
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(photo)}
        />
      ) : (
        <Image
          src={PLAYER_SILHOUETTE}
          alt={`${player.name} 사진 없음 · 기본 유니폼`}
          width={width}
          height={height}
          unoptimized
        />
      )}
      {showNumber && <b className="player-portrait-number">{player.number}</b>}
      {!photo && size === 'large' && <small className="player-portrait-missing">사진 없음</small>}
    </span>
  );
}
