-- Versioned, bounded D1 catalog pages. Career tables are deliberately untouched.
CREATE TABLE catalog_chunks (
  version TEXT NOT NULL,
  section TEXT NOT NULL,
  chunk INTEGER NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY(version,section,chunk)
) WITHOUT ROWID;
--> statement-breakpoint
INSERT INTO catalog_chunks(version,section,chunk,payload)
SELECT (SELECT value FROM catalog_meta WHERE key='version'), 'leagues', chunk,
  json_group_array(json(item))
FROM (
  SELECT CAST((ROW_NUMBER() OVER (ORDER BY sort_order) - 1) / 200 AS INTEGER) AS chunk,
    json_object('id',id,'name',name,'country',country,'flag',flag,'region',region,'label',label,'games',games,'level',level,'source',source,'season',season) AS item
  FROM leagues ORDER BY sort_order
) GROUP BY chunk;
--> statement-breakpoint
INSERT INTO catalog_chunks(version,section,chunk,payload)
SELECT (SELECT value FROM catalog_meta WHERE key='version'), 'clubs', chunk,
  json_group_array(json(item))
FROM (
  SELECT CAST((ROW_NUMBER() OVER (ORDER BY sort_order) - 1) / 200 AS INTEGER) AS chunk,
    json_object('id',id,'league',league_id,'name',name,'short',short,'color',color,'city',city,'division',division,'logo',logo_json) AS item
  FROM clubs ORDER BY sort_order
) GROUP BY chunk;
--> statement-breakpoint
INSERT INTO catalog_chunks(version,section,chunk,payload)
SELECT (SELECT value FROM catalog_meta WHERE key='version'), 'players', chunk,
  json_group_array(json(item))
FROM (
  SELECT CAST((ROW_NUMBER() OVER (ORDER BY sort_order) - 1) / 200 AS INTEGER) AS chunk,
    json_object('id',id,'club',COALESCE(club_id,'fa'),'name',name,'original',original,'pos',position,'age',age,'real',is_real,'country',country,'number',number,'contact',contact,'power',power,'speed',speed,'field',fielding,'stuff',stuff,'control',control,'potential',potential,'salary',salary,'years',years,'source',source,'ageEstimated',age_estimated,'rating',rating_json) AS item
  FROM players ORDER BY sort_order
) GROUP BY chunk;
--> statement-breakpoint
INSERT INTO catalog_chunks(version,section,chunk,payload)
SELECT (SELECT value FROM catalog_meta WHERE key='version'), 'agents', chunk,
  json_group_array(json(item))
FROM (
  SELECT CAST((ROW_NUMBER() OVER (ORDER BY sort_order) - 1) / 200 AS INTEGER) AS chunk,
    json_object('id',id,'name',name,'agency',agency,'fee',fee,'priority',priority) AS item
  FROM agents ORDER BY sort_order
) GROUP BY chunk;
--> statement-breakpoint
INSERT INTO catalog_chunks(version,section,chunk,payload)
SELECT (SELECT value FROM catalog_meta WHERE key='version'), 'coaches', chunk,
  json_group_array(json(item))
FROM (
  SELECT CAST((ROW_NUMBER() OVER (ORDER BY sort_order) - 1) / 200 AS INTEGER) AS chunk,
    json_object('id',id,'name',name,'role',role,'skill',skill,'salary',salary,'style',style,'real',is_real,'sourceClub',source_club,'source',source,'verifiedRole',verified_role) AS item
  FROM coach_candidates ORDER BY sort_order
) GROUP BY chunk;
--> statement-breakpoint
INSERT INTO catalog_chunks(version,section,chunk,payload)
SELECT (SELECT value FROM catalog_meta WHERE key='version'), 'fixtures', chunk,
  json_group_array(json(item))
FROM (
  SELECT CAST((ROW_NUMBER() OVER (ORDER BY date,id) - 1) / 200 AS INTEGER) AS chunk,
    json_object('id',id,'date',date,'league',league,'home',home,'away',away,'time',time,'source',source) AS item
  FROM fixtures ORDER BY date,id
) GROUP BY chunk;
