-- Additional fictional coaching specialists. Existing contracts and real identities are preserved.
INSERT INTO coach_candidates(id,name,role,skill,salary,style,is_real,sort_order) VALUES
('coach-2026-5-0','신우진','배터리',63,12,'기본기',0,1000),
('coach-2026-5-1','Tom Rossi','배터리',72,24,'유망주 육성',0,1001),
('coach-2026-5-2','이시우','배터리',80,60,'실전 중심',0,1002),
('coach-2026-5-3','Lucas Novak','배터리',88,120,'데이터 분석',0,1003),
('coach-2026-6-0','박시우','수석',61,12,'기본기',0,1004),
('coach-2026-6-1','Alex Harris','수석',72,24,'유망주 육성',0,1005),
('coach-2026-6-2','한준서','수석',79,60,'실전 중심',0,1006),
('coach-2026-6-3','Marco Miller','수석',92,120,'데이터 분석',0,1007),
('coach-2026-7-0','임승현','주루·작전',60,12,'기본기',0,1008),
('coach-2026-7-1','Daniel Wilson','주루·작전',71,24,'유망주 육성',0,1009),
('coach-2026-7-2','한현준','주루·작전',78,60,'실전 중심',0,1010),
('coach-2026-7-3','Marco Harris','주루·작전',88,120,'데이터 분석',0,1011),
('coach-2026-8-0','김도윤','불펜',64,12,'기본기',0,1012),
('coach-2026-8-1','Daniel Novak','불펜',68,24,'유망주 육성',0,1013),
('coach-2026-8-2','서승현','불펜',82,60,'실전 중심',0,1014),
('coach-2026-8-3','Lucas Harris','불펜',88,120,'데이터 분석',0,1015),
('coach-2026-9-0','임지훈','재활',62,12,'기본기',0,1016),
('coach-2026-9-1','Marco Clark','재활',74,24,'유망주 육성',0,1017),
('coach-2026-9-2','윤민준','재활',78,60,'실전 중심',0,1018),
('coach-2026-9-3','James Taylor','재활',89,120,'데이터 분석',0,1019) ON CONFLICT(id) DO NOTHING;
--> statement-breakpoint
UPDATE catalog_chunks SET version='world-2026-09-11-v12';
--> statement-breakpoint
UPDATE catalog_meta SET value='world-2026-09-11-v12' WHERE key='version';
--> statement-breakpoint
DELETE FROM catalog_chunks WHERE section='coaches';
--> statement-breakpoint
INSERT INTO catalog_chunks(version,section,chunk,payload)
SELECT (SELECT value FROM catalog_meta WHERE key='version'), 'coaches', chunk, json_group_array(json(item))
FROM (
 SELECT CAST((ROW_NUMBER() OVER (ORDER BY sort_order) - 1) / 200 AS INTEGER) AS chunk,
 json_object('id',id,'name',name,'role',role,'skill',skill,'salary',salary,'style',style,'real',is_real,'sourceClub',source_club,'source',source,'verifiedRole',verified_role) AS item
 FROM coach_candidates ORDER BY sort_order
) GROUP BY chunk;
