-- Source-backed contract end seasons only; annual salary and career saves are preserved.
UPDATE players SET years=4 WHERE id='real-90641259';
--> statement-breakpoint
UPDATE players SET years=8 WHERE id='real-1082852332';
--> statement-breakpoint
UPDATE players SET years=10 WHERE id='real-3518964000';
--> statement-breakpoint
UPDATE players SET years=14 WHERE id='real-899903450';
--> statement-breakpoint
UPDATE players SET years=14 WHERE id='real-2229458502';
--> statement-breakpoint
UPDATE players SET years=9 WHERE id='real-1672817197';
--> statement-breakpoint
UPDATE players SET years=6 WHERE id='real-923417690';
--> statement-breakpoint
UPDATE players SET years=7 WHERE id='real-3287322063';
--> statement-breakpoint
UPDATE players SET years=5 WHERE id='real-3215092341';
--> statement-breakpoint
UPDATE players SET years=9 WHERE id='real-1128932417';
--> statement-breakpoint
UPDATE players SET years=8 WHERE id='real-4013289199';
--> statement-breakpoint
UPDATE players SET years=8 WHERE id='real-1558501292';
--> statement-breakpoint
UPDATE players SET years=8 WHERE id='real-2354343383';
--> statement-breakpoint
UPDATE players SET years=9 WHERE id='real-2962496466';
--> statement-breakpoint
UPDATE players SET years=8 WHERE id='real-4220082753';
--> statement-breakpoint
UPDATE players SET years=6 WHERE id='real-547256539';
--> statement-breakpoint
UPDATE players SET years=6 WHERE id='real-3044260704';
--> statement-breakpoint
UPDATE players SET years=2 WHERE id='real-3999094235';
--> statement-breakpoint
UPDATE players SET years=2 WHERE id='real-2002123842';
--> statement-breakpoint
UPDATE players SET years=1 WHERE id='real-1625163199';
--> statement-breakpoint
UPDATE players SET years=2 WHERE id='real-1135073879';
--> statement-breakpoint
UPDATE players SET years=3 WHERE id='real-3155573834';
--> statement-breakpoint
UPDATE players SET years=3 WHERE id='real-4231710436';
--> statement-breakpoint
UPDATE players SET years=3 WHERE id='real-3223235941';
--> statement-breakpoint
UPDATE players SET years=3 WHERE id='real-1421004339';
--> statement-breakpoint
UPDATE players SET years=2 WHERE id='real-1917268775';
--> statement-breakpoint
UPDATE players SET years=6 WHERE id='real-642898151';
--> statement-breakpoint
INSERT INTO catalog_meta(key,value) VALUES('player_contracts','{"real-90641259":{"throughYear":2029,"source":"https://www.mlb.com/amp/press-release/sf-2024-lee-signing.html"},"real-1082852332":{"throughYear":2033,"source":"https://www.mlb.com/news/longest-contracts-in-baseball-history"},"real-3518964000":{"throughYear":2035,"source":"https://www.mlb.com/news/longest-contracts-in-baseball-history"},"real-899903450":{"throughYear":2039,"source":"https://www.mlb.com/news/longest-contracts-in-baseball-history"},"real-2229458502":{"throughYear":2039,"source":"https://www.mlb.com/news/longest-contracts-in-baseball-history"},"real-1672817197":{"throughYear":2034,"source":"https://www.mlb.com/news/longest-contracts-in-baseball-history"},"real-923417690":{"throughYear":2031,"source":"https://www.mlb.com/news/longest-contracts-in-baseball-history"},"real-3287322063":{"throughYear":2032,"source":"https://www.mlb.com/news/longest-contracts-in-baseball-history"},"real-3215092341":{"throughYear":2030,"source":"https://www.mlb.com/news/longest-contracts-in-baseball-history"},"real-1128932417":{"throughYear":2034,"source":"https://www.mlb.com/news/longest-contracts-in-baseball-history"},"real-4013289199":{"throughYear":2033,"source":"https://www.mlb.com/news/longest-contracts-in-baseball-history"},"real-1558501292":{"throughYear":2033,"source":"https://www.mlb.com/news/longest-contracts-in-baseball-history"},"real-2354343383":{"throughYear":2033,"source":"https://www.mlb.com/news/longest-contracts-in-baseball-history"},"real-2962496466":{"throughYear":2034,"source":"https://www.mlb.com/news/longest-contracts-in-baseball-history"},"real-4220082753":{"throughYear":2033,"source":"https://www.mlb.com/news/longest-contracts-in-baseball-history"},"real-547256539":{"throughYear":2031,"source":"https://www.mlb.com/news/longest-contracts-in-baseball-history"},"real-3044260704":{"throughYear":2031,"source":"https://www.mlb.com/news/longest-contracts-in-baseball-history"},"real-3999094235":{"throughYear":2027,"source":"https://www.koreabaseball.com/MediaNews/News/Interview/View.aspx?bdSe=55974"},"real-2002123842":{"throughYear":2027,"source":"https://tigers.co.kr/contents/press/995404?fromHome=y"},"real-1625163199":{"throughYear":2026,"source":"https://tigers.co.kr/contents/news/1036378"},"real-1135073879":{"throughYear":2027,"source":"https://tigers.co.kr/contents/news/1036154"},"real-3155573834":{"throughYear":2028,"source":"https://sports.donga.com/article/all/20241112/130410238/1"},"real-4231710436":{"throughYear":2028,"source":"https://sports.donga.com/article/all/20241112/130410238/1"},"real-3223235941":{"throughYear":2028,"source":"https://sports.donga.com/article/all/20241112/130410238/1"},"real-1421004339":{"throughYear":2028,"source":"https://sports.donga.com/article/all/20241112/130410238/1"},"real-1917268775":{"throughYear":2027,"source":"https://www.osen.co.kr/article/G1111975124"},"real-642898151":{"throughYear":2031,"source":"https://en.yna.co.kr/view/AEN20240222004552315"}}') ON CONFLICT(key) DO UPDATE SET value=excluded.value;
--> statement-breakpoint
UPDATE catalog_chunks SET version='world-2026-09-18-v18';
--> statement-breakpoint
UPDATE catalog_meta SET value='world-2026-09-18-v18' WHERE key='version';
--> statement-breakpoint
DELETE FROM catalog_chunks WHERE section='players';
--> statement-breakpoint
INSERT INTO catalog_chunks(version,section,chunk,payload)
SELECT (SELECT value FROM catalog_meta WHERE key='version'), 'players', chunk,
  json_group_array(json(item))
FROM (
  SELECT CAST((ROW_NUMBER() OVER (ORDER BY sort_order) - 1) / 200 AS INTEGER) AS chunk,
    json_object('id',id,'club',COALESCE(club_id,'fa'),'name',name,'original',original,'pos',position,'age',age,'real',is_real,'country',country,'number',number,'contact',contact,'power',power,'speed',speed,'field',fielding,'stuff',stuff,'control',control,'potential',potential,'salary',salary,'years',years,'source',source,'ageEstimated',age_estimated,'rating',rating_json) AS item
  FROM players ORDER BY sort_order
) GROUP BY chunk;

