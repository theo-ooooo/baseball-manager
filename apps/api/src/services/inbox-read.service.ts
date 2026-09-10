import { ConflictException, Injectable } from '@nestjs/common';
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
    const results = await db.batch([
      db
        .prepare(
          "SELECT revision,json_extract(state,'$.news') AS news FROM careers WHERE user_id=?",
        )
        .bind(user),
      db
        .prepare('SELECT revision FROM career_actions WHERE user_id=? AND request_id=? LIMIT 1')
        .bind(user, requestId),
    ]);
    const row = results[0].results[0] as { revision: number; news: string | null } | undefined;
    if (!row?.news) return null;
    const news = JSON.parse(row.news) as GameState['news'];
    if (!Array.isArray(news)) return null;
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
      return { patch: { news }, baseRevision: expected, revision: row.revision };
    }
    if (row.revision !== expected) throw conflict();
    for (const message of news)
      if (action.type === 'readAllNews' || message.id === action.id) message.read = true;
    const token = crypto.randomUUID(),
      now = new Date().toISOString();
    const saved = await db.batch([
      db
        .prepare(
          `UPDATE careers SET state=json_set(state,'$.news',json(?)),
         revision=revision+1,updated_at=?,write_token=? WHERE user_id=? AND revision=?
         AND NOT EXISTS(SELECT 1 FROM career_actions WHERE user_id=? AND request_id=?)`,
        )
        .bind(JSON.stringify(news), now, token, user, expected, user, requestId),
      db
        .prepare(
          `INSERT INTO career_actions(user_id,revision,kind,request_id,created_at)
         SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM careers WHERE user_id=? AND write_token=?)`,
        )
        .bind(user, expected + 1, String(action.type), requestId, now, user, token),
    ]);
    if (saved[0].meta.changes !== 1) throw conflict();
    return { patch: { news }, baseRevision: expected, revision: expected + 1 };
  }
}
