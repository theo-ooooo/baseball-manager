import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { GameState, LiveMatch } from '@dugout/shared/types';
import type { LiveMatchPatchResponse } from '@dugout/shared/live-match-commands';
import { matchCommandAction } from '../domain/match-command-actions';
import { createPreparedMatchSimulator } from '../domain/match-simulation';

@Injectable()
export class LiveMatchCommandService {
  async act(
    db: D1Database,
    user: string,
    action: Record<string, unknown>,
  ): Promise<LiveMatchPatchResponse | null> {
    const requestId =
      typeof action.requestId === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(action.requestId)
        ? action.requestId
        : crypto.randomUUID();
    const rows = await db.batch([
      db
        .prepare(
          `SELECT revision,json_extract(state,'$.liveMatch') AS live,
        json_extract(state,'$.club') AS club,json_extract(state,'$.phase') AS phase,
        json_extract(state,'$.managerCareer.status') AS employment,
        json_extract(state,'$.managerCareer.vacationUntil') AS vacation,
        (SELECT league_id FROM clubs WHERE id=json_extract(careers.state,'$.liveMatch.home')) AS league
        FROM careers WHERE user_id=?`,
        )
        .bind(user),
      db
        .prepare('SELECT revision FROM career_actions WHERE user_id=? AND request_id=? LIMIT 1')
        .bind(user, requestId),
    ]);
    const row = rows[0].results[0] as
      | {
          revision: number;
          live: string | null;
          club: string;
          phase: GameState['phase'];
          employment?: string;
          vacation?: string;
          league?: string;
        }
      | undefined;
    if (!row?.live) return null;
    const live = JSON.parse(row.live) as LiveMatch;
    if (
      !live.prepared ||
      !live.timeline ||
      !row.league ||
      !live.opponents?.[live.home === row.club ? 0 : 1]?.length
    )
      return null;
    const expected = Number(action.revision);
    const seen = (rows[1].results[0] as { revision: number } | undefined)?.revision;
    const conflict = () =>
      new ConflictException({
        error: '다른 화면에서 변경됐습니다. 최신 커리어를 불러와 주세요.',
        reload: true,
      });
    if (!Number.isInteger(expected)) throw conflict();
    const response = (): LiveMatchPatchResponse => {
      const visible = { ...live };
      delete visible.prepared;
      delete visible.opponents;
      return { patch: { liveMatch: visible }, baseRevision: expected, revision: expected + 1 };
    };
    if (seen !== undefined) {
      if (seen !== expected + 1 || row.revision !== seen) throw conflict();
      return response();
    }
    if (row.revision !== expected) throw conflict();
    if (row.employment === 'unemployed' || row.vacation)
      throw new BadRequestException(
        '구단에 재직 중이고 휴가가 아닐 때 경기 작전을 지시할 수 있습니다.',
      );
    // The simulator reads only the frozen match input and live metadata. Season state stays in D1.
    const state = {
      ...live.prepared.input,
      club: row.club,
      phase: row.phase,
      liveMatch: live,
    } as GameState;
    try {
      matchCommandAction(state, action, createPreparedMatchSimulator(row.league));
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : '경기 작전을 확인해 주세요.',
      );
    }
    const serialized = JSON.stringify(live);
    if (new TextEncoder().encode(serialized).length > 600_000)
      throw new BadRequestException('경기 기록 처리 한도를 초과했습니다.');
    const now = new Date().toISOString(),
      token = crypto.randomUUID();
    const saved = await db.batch([
      db
        .prepare(
          `UPDATE careers SET state=json_set(state,'$.liveMatch',json(?)),
        revision=revision+1,updated_at=?,write_token=? WHERE user_id=? AND revision=?
        AND NOT EXISTS(SELECT 1 FROM career_actions WHERE user_id=? AND request_id=?)`,
        )
        .bind(serialized, now, token, user, expected, user, requestId),
      db
        .prepare(
          `INSERT INTO career_actions(user_id,revision,kind,request_id,created_at)
        SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM careers WHERE user_id=? AND write_token=?)`,
        )
        .bind(user, expected + 1, String(action.type), requestId, now, user, token),
    ]);
    if (saved[0].meta.changes !== 1) throw conflict();
    return response();
  }
}
