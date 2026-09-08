'use client';
import { ClubBadge } from './club-badge';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useReducedMotion } from './use-reduced-motion';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Flag } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import type { Result, GameState } from '../../packages/shared/src/types';
import { dayLabel } from '../../packages/shared/src/management';
import {
  ballPoint,
  bases,
  between,
  fieldPoints,
  replayScene,
  runnerPoint,
} from '../../packages/shared/src/replay';
import { useWorld } from './world-context';

export function StadiumScene({
  result,
  index,
  playing,
  speed,
  reduced,
  onEnd,
}: {
  result: Result;
  index: number;
  playing: boolean;
  speed: number;
  reduced: boolean;
  onEnd: () => void;
}) {
  const { getClub } = useWorld();
  const [progress, setProgress] = useState(0);
  const elapsed = useRef(0),
    ended = useRef(false),
    callback = useRef(onEnd);
  useEffect(() => {
    callback.current = onEnd;
  }, [onEnd]);
  const scene = useMemo(() => replayScene(result, index), [result, index]);
  useEffect(() => {
    if (!playing || ended.current) return;
    let frame = 0,
      last = 0;
    const tick = (time: number) => {
      if (last) elapsed.current += Math.min(100, time - last) * speed;
      last = time;
      const p = Math.min(1, elapsed.current / (reduced ? 100 : 4200));
      setProgress(p);
      if (p < 1) frame = requestAnimationFrame(tick);
      else {
        ended.current = true;
        callback.current();
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, reduced]);
  const t = reduced ? 1 : progress,
    ball = ballPoint(scene, t),
    batting = getClub(scene.event?.half === 1 ? result.home : result.away),
    defending = getClub(scene.event?.half === 1 ? result.away : result.home);
  const runnerProgress = Math.max(0, Math.min(1, (t - 0.28) / 0.6));
  const after = t > 0.88;
  const outs = scene.play ? (after ? scene.play.after.outs : scene.play.before.outs) : null;
  const defenders = Object.entries(fieldPoints).map(([pos, point]) => {
    const id = scene.defending?.defense[pos as keyof typeof scene.defending.defense];
    const player = scene.defending?.players.find(
      (p) => p.id === (pos === 'P' ? scene.play?.pitcher || id : id),
    );
    const chasing =
      pos === scene.fielder && !['walk', 'strikeout', 'tiebreak', 'homeRun'].includes(scene.kind);
    const move = chasing ? Math.max(0, Math.min(1, (t - 0.22) / 0.43)) : 0;
    return { pos, player, point: between(point, scene.target, move) };
  });
  const liveScore = scene.play
    ? after
      ? scene.play.after.score
      : scene.play.before.score
    : (after ? scene.event?.score : result.log[index - 1]?.score) || [0, 0];
  return (
    <div
      className="stadium-stage"
      style={{ '--attack': batting.color, '--defend': defending.color } as CSSProperties}
    >
      <svg
        className="stadium-background field-2d"
        viewBox="0 0 1536 1024"
        aria-label="2D 탑뷰 야구장"
      >
        <defs>
          <pattern id="grass" width="120" height="120" patternUnits="userSpaceOnUse">
            <rect width="120" height="120" fill="#356c40" />
            <rect width="60" height="120" fill="#3c7848" />
          </pattern>
        </defs>
        <rect width="1536" height="1024" fill="#223b32" />
        <path d="M 160 350 Q 768 -165 1376 350 L 818 960 L 718 960 Z" fill="#a48b65" />
        <path
          d="M 186 350 Q 768 -120 1350 350 L 768 921 Z"
          fill="url(#grass)"
          stroke="#dfc88d"
          strokeWidth="8"
        />
        <path d="M 768 867 L 525 633 L 768 437 L 1011 633 Z" fill="#b79269" />
        <path d="M 768 807 L 585 633 L 768 489 L 951 633 Z" fill="#3c7848" />
        <circle cx="768" cy="643" r="40" fill="#b79269" />
        <circle cx="768" cy="867" r="53" fill="#b79269" />
        <path
          d="M 768 867 L 186 350 M 768 867 L 1350 350"
          stroke="#f0e7d0"
          strokeWidth="5"
          fill="none"
        />
        <path
          d="M 649 890 Q 768 775 887 890"
          stroke="#f0e7d0"
          strokeWidth="4"
          strokeDasharray="10 12"
          fill="none"
        />
        {bases.slice(0, 4).map((b, i) => (
          <rect
            key={i}
            x={b.x - 11}
            y={b.y - 11}
            width="22"
            height="22"
            fill="#fff6df"
            transform={`rotate(45 ${b.x} ${b.y})`}
          />
        ))}
        <rect x="755" y="638" width="26" height="8" fill="#fff6df" />
        <text x="768" y="135" textAnchor="middle" fill="#d9e8d4" fontSize="24" letterSpacing="8">
          DUGOUT PARK
        </text>
      </svg>
      <div className="stadium-scorebug">
        <div>
          <span style={{ borderColor: getClub(result.away).color }}>
            <ClubBadge club={getClub(result.away)} size="tiny" />
            {getClub(result.away).short}
          </span>
          <b>{liveScore[0] || 0}</b>
        </div>
        <div>
          <span style={{ borderColor: getClub(result.home).color }}>
            <ClubBadge club={getClub(result.home)} size="tiny" />
            {getClub(result.home).short}
          </span>
          <b>{liveScore[1] || 0}</b>
        </div>
        <div className="stadium-inning">
          <strong>
            {scene.event?.inning || 1}회 {scene.event?.half ? '말' : '초'}
          </strong>
          <span>
            OUT{' '}
            {outs === null
              ? '—'
              : Array.from({ length: 3 }, (_, i) => (
                  <i key={i} className={i < outs ? 'lit' : ''} />
                ))}
          </span>
        </div>
      </div>
      <svg
        className="stadium-motion"
        viewBox="0 0 1536 1024"
        role="img"
        aria-label={`${scene.event?.inning || 1}회 ${scene.event?.half ? '말' : '초'} 플레이 진행`}
      >
        {scene.play?.before.bases.map(
          (id, i) =>
            id && (
              <circle
                key={i}
                cx={bases[i + 1].x}
                cy={bases[i + 1].y}
                r="24"
                className="occupied-base"
              />
            ),
        )}
        {defenders.map(({ pos, player, point }) => (
          <g key={pos} transform={`translate(${point.x} ${point.y})`} className="stadium-defender">
            <title>
              {pos} {player?.name || ''}
            </title>
            <ellipse cy="16" rx="19" ry="8" className="player-shadow" />
            <circle r="18" />
            <text y="6" className="player-number">
              {player?.number ?? pos}
            </text>
            <text y="40" className="player-label">
              {player?.name || pos}
            </text>
          </g>
        ))}
        {!scene.play && (
          <g transform="translate(728 860)" className="stadium-runner">
            <circle r="17" />
            <text y="-28" className="player-label">
              {scene.batter}
            </text>
          </g>
        )}
        {scene.runners.map((r) => {
          const point = runnerPoint(r.from, r.to, runnerProgress);
          const opacity = r.out && runnerProgress > 0.9 ? 0.25 : 1;
          return (
            <g
              key={r.id}
              transform={`translate(${point.x + (r.from === 0 && runnerProgress === 0 ? -40 : 0)} ${point.y})`}
              className="stadium-runner"
              opacity={opacity}
            >
              <title>
                {r.name}
                {r.out ? ' 아웃' : r.to === 4 ? ' 득점' : ''}
              </title>
              <ellipse cy="15" rx="18" ry="7" className="player-shadow" />
              <circle r="17" />
              <text y="6" className="player-number">
                {scene.batting?.players.find((p) => p.id === r.id)?.number || '·'}
              </text>
              <text y="-27" className="player-label">
                {r.name}
              </text>
            </g>
          );
        })}
        {!['walk', 'strikeout', 'tiebreak'].includes(scene.kind) && t > 0.2 && (
          <path
            d={`M ${bases[0].x} ${bases[0].y} L ${scene.target.x} ${scene.target.y}`}
            className="ball-trail"
          />
        )}
        {t < 0.94 && (
          <g>
            <ellipse cx={ball.x} cy={ball.y + 13} rx="9" ry="5" className="ball-shadow" />
            <circle
              cx={ball.x}
              cy={
                ball.y -
                (scene.fly && t > 0.2 && t < 0.65 ? Math.sin(((t - 0.2) / 0.45) * Math.PI) * 38 : 0)
              }
              r="7"
              className="stadium-ball"
            />
          </g>
        )}
      </svg>
      <div className={`stadium-event ${after ? 'settled' : ''}`}>
        <span>
          {after ? '타석 결과' : t < 0.2 ? '투구' : t < 0.65 ? '플레이 진행' : '주자 이동'}
        </span>
        <strong>
          {after
            ? scene.event?.text || '경기 시작'
            : scene.batter
              ? `${scene.batter} 타석`
              : '경기 준비'}
        </strong>
      </div>
      <div className="stadium-broadcast-tag">
        DUGOUT <span>MATCH REPLAY</span>
      </div>
    </div>
  );
}
function ReplayViewer({ result, close }: { result: Result; close: () => void }) {
  const { getClub } = useWorld();
  const [index, setIndex] = useState(0),
    [playOverride, setPlaying] = useState<boolean | null>(null),
    [speed, setSpeed] = useState('1'),
    [run, setRun] = useState(0);
  const reduced = useReducedMotion(),
    playing = playOverride ?? !reduced;
  const last = Math.max(0, result.log.length - 1),
    event = result.log[index];
  const scene = useMemo(() => replayScene(result, index), [result, index]);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => {
      if (query.matches) setPlaying(false);
    };
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    const pause = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
  }, []);
  function jump(value: number) {
    setIndex(Math.max(0, Math.min(last, value)));
    setRun((n) => n + 1);
  }
  const innings = Array.from(new Set(result.log.map((e) => e.inning)));
  const finished = index === last && !playing;
  return (
    <DialogContent className="stadium-replay-dialog">
      <DialogHeader className="stadium-replay-header">
        <DialogTitle>
          {getClub(result.away).name} <span>vs</span> {getClub(result.home).name}
        </DialogTitle>
        <DialogDescription>
          {result.date || dayLabel(result.day)} ·{' '}
          {result.friendly ? '연습경기' : result.post ? '포스트시즌' : '정규시즌'} · 경기 리플레이
        </DialogDescription>
      </DialogHeader>
      <div className="stadium-replay-layout">
        <div className="stadium-main">
          <StadiumScene
            key={`${index}:${run}`}
            result={result}
            index={index}
            playing={playing}
            speed={Number(speed)}
            reduced={reduced}
            onEnd={() => {
              if (index < last) setIndex((n) => n + 1);
              else setPlaying(false);
            }}
          />
          <div className="stadium-transport">
            <div className="stadium-timeline">
              <Slider
                aria-label="경기 재생 위치"
                min={0}
                max={Math.max(1, last)}
                step={1}
                value={[index]}
                onValueChange={(v) => {
                  setPlaying(false);
                  jump(v[0]);
                }}
                disabled={!result.log.length}
              />
              <span>
                {index + 1} / {result.log.length} 타석
              </span>
            </div>
            <div className="stadium-controls">
              <button
                className="replay-icon"
                aria-label="이전 타석"
                disabled={index === 0}
                onClick={() => jump(index - 1)}
              >
                <SkipBack size={19} />
              </button>
              <button
                className="replay-play"
                disabled={!result.log.length}
                onClick={() => {
                  if (finished) {
                    jump(0);
                    setPlaying(true);
                  } else setPlaying(!playing);
                }}
              >
                {playing ? <Pause size={20} /> : <Play size={20} />}
                <span>{playing ? '일시정지' : finished ? '다시 보기' : '재생'}</span>
              </button>
              <button
                className="replay-icon"
                aria-label="다음 타석"
                disabled={index === last}
                onClick={() => jump(index + 1)}
              >
                <SkipForward size={19} />
              </button>
              <button
                className="replay-icon"
                aria-label="이 타석 다시 보기"
                onClick={() => {
                  jump(index);
                  setPlaying(true);
                }}
              >
                <RotateCcw size={17} />
              </button>
              <Select value={speed} onValueChange={setSpeed}>
                <SelectTrigger className="replay-select" aria-label="재생 속도">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['.5', '1', '2', '4'].map((v) => (
                    <SelectItem key={v} value={v}>
                      {Number(v)}× 속도
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                className="replay-finish"
                onClick={() => {
                  jump(last);
                  setPlaying(false);
                }}
              >
                <Flag size={15} />
                마지막 타석
              </button>
            </div>
          </div>
        </div>
        <aside className="stadium-match-report">
          <div className="replay-duel">
            <small>
              {event?.inning || 1}회 {event?.half ? '말' : '초'} ·{' '}
              {getClub(event?.half ? result.home : result.away).short} 공격
            </small>
            <h3>{scene.batter || '경기 기록'}</h3>
            <p>{scene.pitcher ? `상대 투수 ${scene.pitcher}` : '저장된 타석 결과'}</p>
          </div>
          <div className="replay-innings" aria-label="이닝 선택">
            {innings.map((inn) => (
              <button
                key={inn}
                className={inn === event?.inning ? 'selected' : ''}
                onClick={() => jump(result.log.findIndex((e) => e.inning === inn))}
              >
                {inn}회
              </button>
            ))}
          </div>
          <div className="replay-events" aria-label="현재 이닝 타석">
            {result.log
              .map((e, i) => ({ e, i }))
              .filter(({ e, i }) => e.inning === event?.inning && i < index)
              .map(({ e, i }) => (
                <button className={i === index ? 'current' : ''} key={i} onClick={() => jump(i)}>
                  <small>{e.half ? '말' : '초'}</small>
                  <span>{e.text}</span>
                  <b>
                    {e.score[0]}:{e.score[1]}
                  </b>
                </button>
              ))}
          </div>
          <div className="replay-note">
            {result.replayTeams
              ? '타석 결과·주자·수비 배치를 저장 기록대로 재생합니다. 타구 궤적과 수비 이동은 장면 연출입니다.'
              : '이전 경기 기록입니다. 타석 결과를 야구장에서 재생하며, 저장되지 않은 주자·수비 정보는 표시하지 않습니다.'}
          </div>
          <button className="button secondary compact" onClick={close}>
            더그아웃으로
          </button>
        </aside>
      </div>
    </DialogContent>
  );
}
export function StadiumReplay({ result, close }: { result: Result | null; close: () => void }) {
  return (
    <Dialog
      open={!!result}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      {result && <ReplayViewer key={result.id} result={result} close={close} />}
    </Dialog>
  );
}

export function LiveMatchScreen({
  g,
  act,
  busy,
}: {
  g: GameState;
  act: (a: Record<string, unknown>) => Promise<GameState | null>;
  busy: boolean;
}) {
  const { getClub } = useWorld(),
    live = g.liveMatch!;
  const [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState('2'),
    [settledCount, setSettledCount] = useState(0);
  const settled = settledCount === live.result.log.length;
  const reduced = useReducedMotion();
  const current = useRef({ act, busy });
  useEffect(() => {
    current.current = { act, busy };
  }, [act, busy]);
  const event = live.result.log.at(-1);
  const hasEvent = !!event;
  useEffect(() => {
    if (!playing || busy || live.finished || (hasEvent && !settled)) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled)
        void current.current.act({ type: 'stepMatch' }).then((next) => {
          if (!next) setPlaying(false);
        });
    }, 100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [playing, busy, live.cursor, live.finished, settled, hasEvent]);
  useEffect(() => {
    const pause = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
  }, []);
  return (
    <Dialog open>
      <DialogContent
        className="stadium-replay-dialog live-match-dialog"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="stadium-replay-header">
          <DialogTitle>
            {getClub(live.away).name} <span>vs</span> {getClub(live.home).name}
          </DialogTitle>
          <DialogDescription>
            {live.result.date} ·{' '}
            {live.finished
              ? '경기 종료'
              : event
                ? '경기 진행 중'
                : '경기 준비 · 첫 타석을 시작하세요'}
          </DialogDescription>
        </DialogHeader>
        <div className="stadium-replay-layout">
          <div className="stadium-main">
            <StadiumScene
              key={live.result.log.length}
              result={live.result}
              index={Math.max(0, live.result.log.length - 1)}
              playing={playing && !!event && !live.finished}
              speed={Number(speed)}
              reduced={live.finished || reduced}
              onEnd={() => setSettledCount(live.result.log.length)}
            />
            <div className="stadium-controls live-controls">
              <button
                className="replay-play"
                disabled={busy || live.finished}
                onClick={() => setPlaying(!playing)}
              >
                {playing ? <Pause size={18} /> : <Play size={18} />}{' '}
                {playing ? '일시정지' : event ? '경기 계속' : '플레이볼'}
              </button>
              <select
                aria-label="경기 속도"
                value={speed}
                onChange={(e) => setSpeed(e.target.value)}
              >
                {['1', '2', '4', '8'].map((n) => (
                  <option key={n} value={n}>
                    {n}×
                  </option>
                ))}
              </select>
              <span className="tiny">
                {busy ? '타석 처리 중' : live.finished ? '경기를 마쳤습니다' : '타석마다 자동 저장'}
              </span>
              {live.finished && (
                <button
                  className="button primary compact"
                  disabled={busy}
                  onClick={() => void act({ type: 'completeMatch' })}
                >
                  결과 확인 · 더그아웃으로 →
                </button>
              )}
            </div>
          </div>
          <aside className="stadium-match-report">
            <h3>경기 중계</h3>
            <p className="tiny">
              {live.finished
                ? '최종 기록'
                : event
                  ? '진행이 끝난 타석만 표시합니다.'
                  : '양 팀 선발 라인업'}
            </p>
            {!event &&
              live.result.replayTeams?.map((team, side) => (
                <div className="preview-lineup" key={side}>
                  <strong>{getClub(side ? live.home : live.away).short}</strong>
                  <p>선발 {team.players.find((p) => p.id === team.defense.P)?.name}</p>
                  {team.lineup.map((id, i) => (
                    <small key={id}>
                      {i + 1}. {team.players.find((p) => p.id === id)?.name}
                    </small>
                  ))}
                </div>
              ))}
            <div className="replay-events">
              {live.result.log
                .slice(0, settled || live.finished ? undefined : -1)
                .slice(-12)
                .map((e, i) => (
                  <div className="live-log" key={i}>
                    <small>
                      {e.inning}회 {e.half ? '말' : '초'}
                    </small>
                    <p>{e.text}</p>
                    <b>
                      {e.score[0]} : {e.score[1]}
                    </b>
                  </div>
                ))}
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
