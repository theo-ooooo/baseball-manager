'use client';
import { Trophy, ArrowLeft, ArrowUpRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { GameState } from '@dugout/shared/types';
import { challengeDefinitions } from '@dugout/shared/career-engagement';
import type { Act } from './game-contracts';
import { useChallengeCareer } from './use-challenge-career';
import { switchCareerSlot } from './career-slot';
export function ChallengeEntry() {
  return (
    <button className="button secondary" onClick={() => switchCareerSlot('challenge')}>
      <Trophy size={16} /> 짧은 도전 커리어 <ArrowUpRight size={15} />
    </button>
  );
}
export function ChallengeCareer({
  g,
  act,
  busy,
  onStarted,
  autoOpen = false,
  onClose,
}: {
  autoOpen?: boolean;
  onClose?: () => void;
  g: GameState | null;
  act: Act;
  busy: boolean;
  onStarted: () => Promise<void>;
}) {
  const c = useChallengeCareer(g, act, busy, onStarted, autoOpen),
    challenge = g?.challenge,
    definition = challenge ? challengeDefinitions[challenge.kind] : undefined;
  const setup = (
    <>
      <div className="challenge-options">
        {Object.entries(challengeDefinitions).map(([key, v]) => (
          <button
            key={key}
            aria-pressed={c.kind === key}
            onClick={() => c.setKind(key as typeof c.kind)}
          >
            <small>{v.badge}</small>
            <h3>{v.title}</h3>
            <p>{v.detail}</p>
            <strong>{v.goal}</strong>
          </button>
        ))}
      </div>
      <div className="challenge-form">
        <label>
          감독 이름
          <input
            aria-label="도전 감독 이름"
            value={c.manager}
            maxLength={24}
            onChange={(e) => c.setManager(e.target.value)}
          />
        </label>
        {c.kind === 'chase' ? (
          <label>
            도전 구단
            <select
              aria-label="도전 구단"
              value={c.club}
              onChange={(e) => c.setClub(e.target.value)}
            >
              {c.kbo.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p>
            시작 구단: <strong>{c.weakest.name}</strong> · 도전 지정 구단
          </p>
        )}
      </div>
      <p className="challenge-note">
        본 커리어의 선수·계약·경기는 그대로 보관됩니다.{' '}
        {c.kind === 'chase' && '10경기 도전의 시작 순위는 가상으로 구성된 상황입니다.'}{' '}
        {g && '시작하면 이전 도전 저장을 새 도전으로 교체합니다.'}
      </p>
      <button className="button primary" disabled={busy} onClick={() => void c.start()}>
        {g ? '이 도전을 새로 시작' : '도전 시작'}
      </button>
    </>
  );
  if (!g)
    return (
      <main className="challenge-start">
        <button className="text-button" onClick={() => c.switchSlot('main')}>
          <ArrowLeft size={16} /> 본 커리어로
        </button>
        <header>
          <span>짧게 시작하는 감독의 승부</span>
          <h1>이번에는 무엇을 뒤집어 볼까요?</h1>
          <p>목표가 있는 별도의 저장에서 도전합니다.</p>
        </header>
        {setup}
      </main>
    );
  if (c.slot !== 'challenge') return <ChallengeEntry />;
  return (
    <section className="challenge-status" aria-label="도전 커리어">
      <div>
        <span>도전 저장 · 본 커리어와 분리됨</span>
        <h2>
          {definition?.title || '도전 커리어'}{' '}
          {challenge?.status === 'success'
            ? '· 성공!'
            : challenge?.status === 'failed'
              ? '· 종료'
              : ''}
        </h2>
        <p>{challenge?.message || definition?.goal}</p>
        {challenge?.status === 'active' && (
          <strong>
            {challenge.kind === 'chase'
              ? `남은 정규시즌 ${Math.max(0, 10 - challenge.played)}경기`
              : `${g.year - challenge.startedYear + 1}/2 시즌 · 이번 시즌 포스트시즌을 노립니다`}
          </strong>
        )}
      </div>
      <div className="challenge-status-actions">
        <button className="button secondary" disabled={busy} onClick={() => c.switchSlot('main')}>
          본 커리어로 돌아가기
        </button>
        <button
          className="text-button"
          disabled={busy || !!g.liveMatch}
          onClick={() => c.setOpen(true)}
        >
          새 도전
        </button>
      </div>
      <Dialog
        open={c.open}
        onOpenChange={(value) => {
          c.setOpen(value);
          if (!value) onClose?.();
        }}
      >
        <DialogContent className="challenge-dialog">
          <DialogHeader>
            <DialogTitle>새 도전 시작</DialogTitle>
            <DialogDescription>
              현재 도전 저장만 교체합니다. 본 커리어는 유지됩니다.
            </DialogDescription>
          </DialogHeader>
          {setup}
        </DialogContent>
      </Dialog>
    </section>
  );
}
