'use client';
import { LockKeyhole, Megaphone, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { GameState } from '@dugout/shared/types';
import { managerJobOpen } from '@dugout/shared/manager-career';
import { useManagerApplication } from './use-manager-application';
import { Badge, Choice } from '../../components/game-ui';
import type { Act } from './game-contracts';
export function ManagerApplication({
  g,
  clubId,
  act,
  busy,
  close,
}: {
  g: GameState;
  clubId: string;
  act: Act;
  busy: boolean;
  close: () => void;
}) {
  const { club, employed, count, channel, setChannel, target, setTarget, submit } =
    useManagerApplication(g, clubId, act, busy, close);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
    >
      <DialogContent className="manager-application-dialog">
        <DialogHeader>
          <DialogTitle>다음 도전 · {club.name}</DialogTitle>
          <DialogDescription>이사회에 어떤 방식으로 관심을 전할까요?</DialogDescription>
        </DialogHeader>
        <div className="application-club">
          <Badge club={club} size="large" />
          <div>
            <strong>{club.name}</strong>
            <p>
              {g.managerJobs?.[clubId]?.vacant
                ? '새 감독을 찾고 있습니다.'
                : '현 감독의 입지가 흔들리고 있습니다.'}
            </p>
          </div>
        </div>
        <div className="application-channels" role="group" aria-label="감독직 접촉 방식">
          <button aria-pressed={channel === 'private'} onClick={() => setChannel('private')}>
            <LockKeyhole size={22} />
            <strong>비공개로 접촉하기</strong>
            <span>이사회와 조용히 이야기를 시작합니다.</span>
            <small>현 구단에 공개 발표 없음</small>
          </button>
          <button aria-pressed={channel === 'public'} onClick={() => setChannel('public')}>
            <Megaphone size={22} />
            <strong>공개적으로 도전하기</strong>
            <span>언론을 통해 감독직에 대한 의지를 밝힙니다.</span>
            <small>
              {employed ? '현 구단주 신임도 8%p 하락' : '공개 지원 소식이 수신함에 기록됩니다.'}
            </small>
          </button>
        </div>
        <div className="application-pitch">
          <label>이사회에 전할 첫 약속</label>
          <p>
            {g.managerJobs?.[clubId]?.expectation?.tier} · 구단 기대{' '}
            {g.managerJobs?.[clubId]?.expectation?.targetRank ?? target}위 이내
          </p>
          <Choice
            label="지원할 구단의 시즌 순위 목표"
            value={String(target)}
            onChange={(v) => setTarget(Number(v))}
            items={Array.from({ length: Math.ceil(count * 0.75) }, (_, i) => ({
              value: String(i + 1),
              label: `${i + 1}위 이내를 목표로 하겠습니다.`,
            }))}
          />
          <p>
            {employed
              ? '현재 감독직을 유지하면서 심사와 면접을 진행합니다. 최종 계약에 서명할 때 이직합니다.'
              : '구단이 경력과 목표를 검토한 뒤 수신함으로 연락합니다.'}
          </p>
        </div>
        <footer>
          <span>첫 답변까지 약 3일</span>
          <button
            className="button primary"
            disabled={busy || !g.managerJobs?.[clubId] || !managerJobOpen(g.managerJobs[clubId])}
            onClick={() => void submit()}
          >
            {channel === 'private' ? '비공개 접촉 전달' : '공개 도전 선언'}
            <ArrowRight size={16} />
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
