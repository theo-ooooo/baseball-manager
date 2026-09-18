import type { Player } from '@dugout/shared/types';

export function PlayerContractBasis({ player }: { player: Player }) {
  if (player.club === 'fa') return null;
  if (player.contractSigned) return <small className="block muted">게임에서 체결한 계약</small>;
  if (!player.catalogContract) return <small className="block muted">계약 기간 · 게임 설정</small>;
  return (
    <small className="block muted">
      실제 계약 기간 반영 · {player.catalogContract.throughYear}시즌까지{' '}
      <a href={player.catalogContract.source} target="_blank" rel="noreferrer">
        발표 자료
      </a>
    </small>
  );
}
