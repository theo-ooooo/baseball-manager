-- Restore omitted Lotte catcher Son Seong-bin, KBO 51528. Career saves and transfers are preserved.
INSERT INTO players (id,club_id,name,original,position,age,is_real,country,number,contact,power,speed,fielding,stuff,control,potential,salary,years,source,age_estimated,rating_json,sort_order) VALUES ('real-2149789910','kbo-lotte','손성빈','손성빈','C',24,1,'대한민국',28,55,61,52,50,50,50,58,14,3,'https://www.koreabaseball.com/Record/Player/HitterDetail/Total.aspx?playerId=51528',0,'{"version":"performance-2025-v2","status":"provisional","season":2025,"source":"https://www.koreabaseball.com/Record/Player/HitterBasic/Basic1.aspx","record":{"name":"손성빈","league":"kbo","season":2025,"kind":"bat","source":"https://www.koreabaseball.com/Record/Player/HitterBasic/Basic1.aspx","team":"롯데","pa":69,"ab":62,"h":9,"hr":1,"tb":12,"g":51,"bb":4,"hbp":1,"k":20,"gdp":1,"obp":0.209,"slg":0.194,"sb":0,"cs":0},"method":"시즌 성적 · 표본 보정 v2 · 출루·주루 기록 확장","estimatedAttributes":["수비"],"base":{"contact":55,"power":61,"speed":52,"field":50,"stuff":50,"control":50,"potential":58}}',(SELECT MAX(sort_order)+1 FROM players));
--> statement-breakpoint
DELETE FROM catalog_chunks WHERE section='players' AND version=(SELECT value FROM catalog_meta WHERE key='version');
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
UPDATE catalog_chunks SET version='world-2026-09-10-v10' WHERE version=(SELECT value FROM catalog_meta WHERE key='version');
--> statement-breakpoint
UPDATE catalog_meta SET value='world-2026-09-10-v10' WHERE key='version';
--> statement-breakpoint
UPDATE catalog_meta SET value=json_set(value, '$."real-2149789910"', json('{"league":"kbo","officialId":"51528","asOf":"2026-09-10","url":"https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/person/middle/2026/51528.jpg","source":"https://www.koreabaseball.com/Record/Player/HitterDetail/Total.aspx?playerId=51528"}')) WHERE key='player_portraits';
