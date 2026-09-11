INSERT INTO catalog_meta(key,value) VALUES('draft_rules','{"kbo":{"year":2026,"date":"2026-09-21","rounds":11,"previousYear":2025,"previousOrder":["kbo-lg","kbo-hanwha","kbo-ssg","kbo-samsung","kbo-nc","kbo-kt","kbo-lotte","kbo-kia","kbo-doosan","kbo-kiwoom"],"source":"https://www.koreabaseball.com/MediaNews/Notice/View.aspx?bdSe=12137"}}') ON CONFLICT(key) DO UPDATE SET value=excluded.value;
--> statement-breakpoint
UPDATE catalog_chunks SET version='world-2026-09-11-v14';
--> statement-breakpoint
UPDATE catalog_meta SET value='world-2026-09-11-v14' WHERE key='version';
