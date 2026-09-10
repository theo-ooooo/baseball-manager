import { Injectable } from '@nestjs/common';
import type {
  ManagerConversationState,
  ManagerConversationPatch,
} from '@dugout/shared/manager-commands';

@Injectable()
export class ManagerConversationRepository {
  async read(db: D1Database, user: string, requestId: string, offerId: string) {
    // D1 extracts only conversation inputs. Player/history/world JSON never enters the Worker.
    const results = await db.batch([
      db
        .prepare(
          `SELECT revision, json_object(
        'year',json_extract(state,'$.year'), 'day',json_extract(state,'$.day'),
        'calendar',json_object('openingDate',json_extract(state,'$.calendar.openingDate')),
        'liveMatch',CASE WHEN json_type(state,'$.liveMatch')='object' THEN 1 ELSE 0 END,
        'managerCareer',json_extract(state,'$.managerCareer'),
        'managerJobs',json_extract(state,'$.managerJobs'),
        'news',json_extract(state,'$.news')
      ) AS context FROM careers WHERE user_id=?`,
        )
        .bind(user),
      db
        .prepare('SELECT revision FROM career_actions WHERE user_id=? AND request_id=? LIMIT 1')
        .bind(user, requestId),
      db
        .prepare(
          `SELECT c.name,c.league_id AS league,
        (SELECT COUNT(*) FROM clubs WHERE league_id=c.league_id) AS count
        FROM clubs c WHERE c.id=(SELECT json_extract(value,'$.club')
          FROM careers,json_each(careers.state,'$.managerCareer.offers')
          WHERE careers.user_id=? AND json_extract(value,'$.id')=? LIMIT 1)`,
        )
        .bind(user, offerId),
    ]);
    const row = results[0].results[0] as { revision: number; context: string } | undefined;
    return {
      state: row ? (JSON.parse(row.context) as ManagerConversationState) : null,
      revision: row?.revision || 0,
      seenRevision: (results[1].results[0] as { revision: number } | undefined)?.revision,
      club: results[2].results[0] as { name: string; league: string; count: number } | undefined,
    };
  }
  async save(
    db: D1Database,
    user: string,
    expected: number,
    patch: ManagerConversationPatch,
    kind: string,
    requestId: string,
  ) {
    const token = crypto.randomUUID(),
      now = new Date().toISOString();
    // Same revision CAS and action journal as full saves, in one transaction. Only allowlisted
    // JSON paths change; rosters, finances, archives and their relational projections stay intact.
    const result = await db.batch([
      db
        .prepare(
          `UPDATE careers SET state=json_set(state,'$.managerCareer',json(?),'$.news',json(?)),
        revision=revision+1,updated_at=?,write_token=? WHERE user_id=? AND revision=?
        AND NOT EXISTS(SELECT 1 FROM career_actions WHERE user_id=? AND request_id=?)`,
        )
        .bind(
          JSON.stringify(patch.managerCareer),
          JSON.stringify(patch.news),
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
        .bind(user, expected + 1, kind, requestId, now, user, token),
    ]);
    return result[0].meta.changes === 1;
  }
}
