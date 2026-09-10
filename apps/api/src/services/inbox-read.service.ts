import { isClubDutyReport } from '@dugout/shared/employment-reports';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { respondPlayerNews } from '../domain/club-dynamics';
import type { GameState } from '@dugout/shared/types';
import type { InboxReadPatchResponse } from '@dugout/shared/inbox-commands';

@Injectable()
export class InboxReadService {
  async act(
    db: D1Database,
    user: string,
    action: Record<string, unknown>,
  ): Promise<InboxReadPatchResponse | null> {
    const requestId =
      typeof action.requestId === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(action.requestId)
        ? action.requestId
        : crypto.randomUUID();
    // Reading a message must not load players, simulate the world, or rewrite projections.
    const conversation = action.type === 'respondNews';
    const results = await db.batch([
      db
        .prepare(
          conversation
            ? `SELECT revision,json_extract(state,'$.news') AS news,
              json_extract(state,'$.roster') AS roster,json_extract(state,'$.day') AS day,
              json_extract(state,'$.year') AS year,json_extract(state,'$.calendar') AS calendar,
              json_extract(state,'$.phase') AS phase,json_extract(state,'$.pitching') AS pitching,
              json_extract(state,'$.managerCareer.status') AS employment,
              json_extract(state,'$.managerCareer.vacationUntil') AS vacation
              FROM careers WHERE user_id=?`
            : "SELECT revision,json_extract(state,'$.news') AS news,json_extract(state,'$.managerCareer.status') AS employment FROM careers WHERE user_id=?",
        )
        .bind(user),
      db
        .prepare('SELECT revision FROM career_actions WHERE user_id=? AND request_id=? LIMIT 1')
        .bind(user, requestId),
    ]);
    const row = results[0].results[0] as
      | {
          revision: number;
          news: string | null;
          roster?: string;
          day: number;
          year: number;
          phase: GameState['phase'];
          pitching?: string;
          calendar?: string;
          employment?: string;
          vacation?: string;
        }
      | undefined;
    if (!row?.news) return null;
    let news = JSON.parse(row.news) as GameState['news'];
    if (!Array.isArray(news)) return null;
    if (row.employment === 'unemployed')
      for (const message of news)
        if (isClubDutyReport(message)) {
          message.read = true;
          message.employmentClosed = true;
        }
    const roster =
      conversation && row.roster ? (JSON.parse(row.roster) as GameState['roster']) : [];
    const subject = roster.find((p) => p.id === news.find((n) => n.id === action.id)?.playerId);
    const patch = (): InboxReadPatchResponse['patch'] => ({
      news,
      ...(subject?.mood ? { playerMood: { id: subject.id, mood: subject.mood } } : {}),
    });
    const expected = Number(action.revision);
    const seen = (results[1].results[0] as { revision: number } | undefined)?.revision;
    const conflict = () =>
      new ConflictException({
        error: '다른 화면에서 변경됐습니다. 최신 커리어를 불러와 주세요.',
        reload: true,
      });
    if (!Number.isInteger(expected)) throw conflict();
    if (seen !== undefined) {
      if (seen !== expected + 1 || row.revision !== seen) throw conflict();
      if (conversation && !subject?.mood) return null;
      return { patch: patch(), baseRevision: expected, revision: row.revision };
    }
    if (row.revision !== expected) throw conflict();
    if (conversation) {
      if (row.employment === 'unemployed' || row.vacation)
        throw new BadRequestException(
          '구단에 재직 중이고 휴가가 아닐 때 선수 면담에 답변할 수 있습니다.',
        );
      if (!subject) throw new BadRequestException('답변할 면담과 현재 소속 선수를 확인해 주세요.');
      if (!subject.mood) return null; // Older saves use the existing mood migration once.
      try {
        const next = respondPlayerNews(
          {
            news,
            roster,
            day: row.day,
            year: row.year,
            phase: row.phase,
            pitching: row.pitching ? JSON.parse(row.pitching) : undefined,
            calendar: row.calendar ? JSON.parse(row.calendar) : undefined,
          },
          action,
        );
        news = next.news;
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : '선수 면담을 확인해 주세요.',
        );
      }
    } else
      for (const message of news)
        if (action.type === 'readAllNews' || message.id === action.id) message.read = true;
    const token = crypto.randomUUID(),
      now = new Date().toISOString();
    const saved = await db.batch([
      db
        .prepare(
          `UPDATE careers SET state=json_set(state,'$.news',json(?)${conversation ? ',?,json(?)' : ''}),
         revision=revision+1,updated_at=?,write_token=? WHERE user_id=? AND revision=?
         AND NOT EXISTS(SELECT 1 FROM career_actions WHERE user_id=? AND request_id=?)`,
        )
        .bind(
          JSON.stringify(news),
          ...(conversation
            ? [`$.roster[${roster.indexOf(subject!)}].mood`, JSON.stringify(subject!.mood)]
            : []),
          now,
          token,
          user,
          expected,
          user,
          requestId,
        ),
      db
        .prepare(
          `INSERT INTO career_actions(user_id,revision,kind,request_id,created_at)
         SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM careers WHERE user_id=? AND write_token=?)`,
        )
        .bind(user, expected + 1, String(action.type), requestId, now, user, token),
      ...(conversation
        ? [
            db
              .prepare(
                `UPDATE career_players SET data=json_set(data,'$.mood',json(?))
        WHERE user_id=? AND player_id=? AND EXISTS(SELECT 1 FROM careers WHERE user_id=? AND write_token=?)`,
              )
              .bind(JSON.stringify(subject!.mood), user, subject!.id, user, token),
          ]
        : []),
    ]);
    if (saved[0].meta.changes !== 1) throw conflict();
    return { patch: patch(), baseRevision: expected, revision: expected + 1 };
  }
}
