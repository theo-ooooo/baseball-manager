import { sqliteTable, text, integer, real, primaryKey, index } from 'drizzle-orm/sqlite-core';

export const catalogMeta = sqliteTable('catalog_meta', {
  key: text('key').primaryKey(), value: text('value').notNull(),
});
export const leagues = sqliteTable('leagues', {
  id: text('id').primaryKey(), name: text('name').notNull(), country: text('country').notNull(),
  flag: text('flag').notNull(), region: text('region').notNull(), label: text('label').notNull(),
  games: integer('games').notNull(), level: integer('level').notNull(), source: text('source').notNull(),
  season: text('season').notNull(), sortOrder: integer('sort_order').notNull(),
});
export const clubs = sqliteTable('clubs', {
  id: text('id').primaryKey(), leagueId: text('league_id').notNull().references(() => leagues.id),
  name: text('name').notNull(), short: text('short').notNull(), color: text('color').notNull(),
  city: text('city').notNull(), division: text('division').notNull(), sortOrder: integer('sort_order').notNull(),
}, t => [index('idx_clubs_league').on(t.leagueId)]);
export const players = sqliteTable('players', {
  id: text('id').primaryKey(), clubId: text('club_id').references(() => clubs.id),
  name: text('name').notNull(), original: text('original').notNull(), position: text('position').notNull(),
  age: integer('age').notNull(), isReal: integer('is_real', { mode: 'boolean' }).notNull(),
  country: text('country').notNull(), number: integer('number').notNull(), contact: real('contact').notNull(),
  power: real('power').notNull(), speed: real('speed').notNull(), fielding: real('fielding').notNull(),
  stuff: real('stuff').notNull(), control: real('control').notNull(), potential: real('potential').notNull(),
  salary: real('salary').notNull(), years: integer('years').notNull(), source: text('source'), ageEstimated: integer('age_estimated', {mode:'boolean'}).notNull().default(false),
  rating: text('rating_json'),
  sortOrder: integer('sort_order').notNull(),
}, t => [index('idx_players_club').on(t.clubId), index('idx_players_name').on(t.name)]);
export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(), name: text('name').notNull(), agency: text('agency').notNull(),
  fee: real('fee').notNull(), priority: text('priority').notNull(), sortOrder: integer('sort_order').notNull(),
});
export const coachCandidates = sqliteTable('coach_candidates', {
  id: text('id').primaryKey(), name: text('name').notNull(), role: text('role').notNull(),
  skill: integer('skill').notNull(), salary: real('salary').notNull(), style: text('style').notNull(), real: integer('is_real', {mode:'boolean'}).notNull().default(false),
  sourceClub: text('source_club'), source: text('source'), verifiedRole: text('verified_role'),
  sortOrder: integer('sort_order').notNull(),
});
export const careers = sqliteTable('careers', {
  userId: text('user_id').primaryKey(), state: text('state').notNull(),
  revision: integer('revision').notNull().default(1), updatedAt: text('updated_at').notNull(),
  writeToken: text('write_token').notNull().default(''),
});
export const careerPlayers = sqliteTable('career_players', {
  userId: text('user_id').notNull().references(() => careers.userId, { onDelete: 'cascade' }),
  playerId: text('player_id').notNull(), clubId: text('club_id').notNull(), position: text('position').notNull(),
  name: text('name').notNull(), data: text('data').notNull(),
}, t => [primaryKey({ columns: [t.userId, t.playerId] })]);
export const contracts = sqliteTable('contracts', {
  userId: text('user_id').notNull().references(() => careers.userId, { onDelete: 'cascade' }),
  playerId: text('player_id').notNull(), clubId: text('club_id').notNull(),
  salary: real('salary').notNull(), years: integer('years').notNull(), season: integer('season').notNull(),
  agentId: text('agent_id').notNull().references(() => agents.id),
}, t => [primaryKey({ columns: [t.userId, t.playerId] })]);
export const careerStaff = sqliteTable('career_staff', {
  userId: text('user_id').notNull().references(() => careers.userId, { onDelete: 'cascade' }),
  role: text('role').notNull(), coachId: text('coach_id').notNull(), name: text('name').notNull(),
  skill: integer('skill').notNull(), salary: real('salary').notNull(), style: text('style').notNull(), real: integer('is_real', {mode:'boolean'}).notNull().default(false),
  sourceClub: text('source_club'), source: text('source'), verifiedRole: text('verified_role'),
}, t => [primaryKey({ columns: [t.userId, t.role] })]);
export const negotiations = sqliteTable('negotiations', {
  userId: text('user_id').notNull().references(() => careers.userId, { onDelete: 'cascade' }),
  dealId: text('deal_id').notNull(), playerId: text('player_id').notNull(),
  status: text('status').notNull(), salary: real('salary').notNull(), years: integer('years').notNull(),
  data: text('data').notNull(),
}, t => [primaryKey({ columns: [t.userId, t.dealId] })]);
export const careerStandings = sqliteTable('career_standings', {
  userId: text('user_id').notNull().references(() => careers.userId, { onDelete: 'cascade' }),
  clubId: text('club_id').notNull().references(() => clubs.id), leagueId: text('league_id').notNull(),
  season: integer('season').notNull(), wins: integer('wins').notNull(), losses: integer('losses').notNull(),
  draws: integer('draws').notNull(), runsFor: integer('runs_for').notNull(), runsAgainst: integer('runs_against').notNull(),
}, t => [primaryKey({ columns: [t.userId, t.clubId] })]);
export const careerMatches = sqliteTable('career_matches', {
  userId: text('user_id').notNull().references(() => careers.userId, { onDelete: 'cascade' }),
  matchId: text('match_id').notNull(), season: integer('season').notNull(), day: integer('day').notNull(),
  home: text('home').notNull(), away: text('away').notNull(), homeScore: integer('home_score').notNull(),
  awayScore: integer('away_score').notNull(), data: text('data').notNull(),
}, t => [primaryKey({ columns: [t.userId, t.matchId] })]);
export const transfers = sqliteTable('transfers', {
  id: text('id').primaryKey(), userId: text('user_id').notNull().references(() => careers.userId, { onDelete: 'cascade' }),
  playerId: text('player_id').notNull(), playerName: text('player_name').notNull(),
  fromClub: text('from_club').notNull(), toClub: text('to_club').notNull(),
  kind: text('kind').notNull(), season: integer('season').notNull(), day: integer('day').notNull(),
  revision: integer('revision').notNull(),
}, t => [index('idx_transfers_user_revision').on(t.userId, t.revision)]);
export const financeEntries = sqliteTable('finance_entries', {
  id: text('id').primaryKey(), userId: text('user_id').notNull().references(() => careers.userId, { onDelete: 'cascade' }),
  revision: integer('revision').notNull(), season: integer('season').notNull(), day: integer('day').notNull(),
  kind: text('kind').notNull(), amount: real('amount').notNull(), balance: real('balance').notNull(),
  createdAt: text('created_at').notNull(),
}, t => [index('idx_finance_user_revision').on(t.userId, t.revision)]);
export const careerActions = sqliteTable('career_actions', {
  userId: text('user_id').notNull().references(() => careers.userId, { onDelete: 'cascade' }),
  revision: integer('revision').notNull(), kind: text('kind').notNull(), requestId: text('request_id').notNull(),
  createdAt: text('created_at').notNull(),
}, t => [primaryKey({ columns: [t.userId, t.revision] }), index('idx_actions_user_request').on(t.userId, t.requestId)]);
