import { Injectable } from '@nestjs/common';
import type {
  WorldCatalog,
  Player,
  League,
  Club,
  Agent,
  Coach,
  Fixture,
} from '../../../../packages/shared/src/types';
import { blankStats } from '../../../../packages/shared/src/game-view';

@Injectable()
export class CatalogRepository {
  private readonly cache = new WeakMap<
    D1Database,
    { version: string; world: Promise<WorldCatalog> }
  >();

  async getWorld(db: D1Database): Promise<WorldCatalog> {
    const meta = await db
      .prepare('SELECT key, value FROM catalog_meta')
      .all<{ key: string; value: string }>();
    const values = Object.fromEntries(meta.results.map((row) => [row.key, row.value]));
    if (!values.version) throw new Error('World database migrations have not been applied');
    const cached = this.cache.get(db);
    if (cached?.version === values.version) return cached.world;
    const world = this.readWorld(db, values);
    this.cache.set(db, { version: values.version, world });
    try {
      return await world;
    } catch (error) {
      this.cache.delete(db);
      throw error;
    }
  }

  private async readWorld(db: D1Database, meta: Record<string, string>): Promise<WorldCatalog> {
    const [leagueRows, clubRows, playerRows, agentRows, coachRows, fixtureRows] = await db.batch([
      db.prepare(
        'SELECT id,name,country,flag,region,label,games,level,source,season FROM leagues ORDER BY sort_order',
      ),
      db.prepare(
        'SELECT id,league_id AS league,name,short,color,city,division,logo_json AS logo FROM clubs ORDER BY sort_order',
      ),
      db.prepare(
        "SELECT id,COALESCE(club_id,'fa') AS club,name,original,position AS pos,age,is_real AS real,country,number,contact,power,speed,fielding AS field,stuff,control,potential,salary,years,source,age_estimated AS ageEstimated,rating_json AS rating FROM players ORDER BY sort_order",
      ),
      db.prepare('SELECT id,name,agency,fee,priority FROM agents ORDER BY sort_order'),
      db.prepare(
        'SELECT id,name,role,skill,salary,style,is_real AS real,source_club AS sourceClub,source,verified_role AS verifiedRole FROM coach_candidates ORDER BY sort_order',
      ),
      db.prepare('SELECT id,date,league,home,away,time,source FROM fixtures ORDER BY date,id'),
    ]);
    const players = (playerRows.results as unknown as Player[]).map((p) => ({
      ...p,
      rating: typeof p.rating === 'string' ? JSON.parse(p.rating) : p.rating,
      real: Boolean(p.real),
      ageEstimated: Boolean(p.ageEstimated),
      condition: 100,
      stats: blankStats(),
      source: p.source || undefined,
    }));
    if (
      !leagueRows.results.length ||
      !clubRows.results.length ||
      !players.length ||
      !agentRows.results.length
    )
      throw new Error('World database is incomplete');
    return {
      version: meta.version,
      year: Number(meta.year),
      rosterNote: meta.roster_note,
      leagues: leagueRows.results as unknown as League[],
      clubs: (clubRows.results as unknown as (Omit<Club, 'logo'> & { logo: string | null })[]).map(
        (club) => ({ ...club, logo: club.logo ? JSON.parse(club.logo) : undefined }),
      ),
      players,
      fixtures: fixtureRows.results as unknown as Fixture[],
      agents: agentRows.results as unknown as Agent[],
      coaches: (coachRows.results as unknown as Coach[]).map((c) => ({
        ...c,
        real: Boolean(c.real),
      })),
    };
  }
}
