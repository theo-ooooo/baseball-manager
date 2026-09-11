import { Injectable } from '@nestjs/common';
import type {
  WorldCatalog,
  Player,
  League,
  Club,
  Agent,
  Coach,
  Fixture,
} from '@dugout/shared/types';
import { blankStats } from '@dugout/shared/game-view';

@Injectable()
export class CatalogRepository {
  private readonly cache = new WeakMap<D1Database, { version: string; world: WorldCatalog }>();

  async getWorld(db: D1Database): Promise<WorldCatalog> {
    const cached = this.cache.get(db);
    if (cached) {
      const version = await db
        .prepare("SELECT value FROM catalog_meta WHERE key='version'")
        .first<{ value: string }>();
      if (version?.value === cached.version) return cached.world;
    }
    const meta = await db
      .prepare('SELECT key, value FROM catalog_meta')
      .all<{ key: string; value: string }>();
    const values = Object.fromEntries(meta.results.map((row) => [row.key, row.value]));
    if (!values.version) throw new Error('World database migrations have not been applied');
    if (cached?.version === values.version) return cached.world;
    const world = await this.readWorld(db, values);
    // Store resolved data only: Worker requests must not share in-flight D1 I/O.
    this.cache.set(db, { version: values.version, world });
    return world;
  }

  private async readWorld(db: D1Database, meta: Record<string, string>): Promise<WorldCatalog> {
    const pages = await db
      .prepare(
        'SELECT section,payload FROM catalog_chunks WHERE version = ? ORDER BY section,chunk',
      )
      .bind(meta.version)
      .all<{ section: string; payload: string }>();
    const sections = ['leagues', 'clubs', 'players', 'agents', 'coaches', 'fixtures'];
    const packed = new Map<string, unknown[]>();
    for (const page of pages.results) {
      const rows: unknown = JSON.parse(page.payload);
      if (!Array.isArray(rows)) throw new Error('Invalid catalog page');
      const previous = packed.get(page.section) || [];
      previous.push(...rows);
      packed.set(page.section, previous);
    }
    // A later catalog migration may change the version before rebuilding its pages.
    // Fall back to the canonical D1 tables, never stale pages or bundled seed data.
    const [leagueRows, clubRows, playerRows, agentRows, coachRows, fixtureRows] = sections.every(
      (section) => packed.has(section),
    )
      ? sections.map((section) => ({ results: packed.get(section)! }))
      : await db.batch([
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
    // Official photo identities live in catalog_meta and attach by player id, never by name.
    const portraits: Record<string, Player['portrait']> = JSON.parse(meta.player_portraits || '{}');
    const nationalities: Record<string, Pick<Player, 'country' | 'nationalTeam'>> = JSON.parse(
      meta.player_nationalities || '{}',
    );
    const players = (playerRows.results as unknown as Player[]).map((p) => ({
      ...p,
      country:
        nationalities[p.id]?.country ||
        (!p.real && p.country === '미국 · 캐나다'
          ? p.club === 'mlb-bluejays'
            ? '캐나다'
            : '미국'
          : p.country),
      nationalTeam: nationalities[p.id]?.nationalTeam,
      portrait: portraits[p.id],
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
    const managers: Record<string, Club['manager']> = JSON.parse(meta.club_managers || '{}');
    return {
      version: meta.version,
      year: Number(meta.year),
      rosterNote: meta.roster_note,
      leagues: leagueRows.results as unknown as League[],
      clubs: (clubRows.results as unknown as (Omit<Club, 'logo'> & { logo: string | null })[]).map(
        (club) => ({
          ...club,
          manager: managers[club.id],
          logo: club.logo ? JSON.parse(club.logo) : undefined,
        }),
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
