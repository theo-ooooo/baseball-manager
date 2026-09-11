import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

test('Forward catalog migration preserves existing career bytes, ownership, contracts and archives', () => {
  const db = new DatabaseSync(':memory:');
  try {
    const entries = JSON.parse(readFileSync('apps/api/drizzle/meta/_journal.json', 'utf8')).entries;
    const apply = (entry) =>
      db.exec(readFileSync('apps/api/drizzle/' + entry.tag + '.sql', 'utf8'));
    entries.filter((e) => e.idx <= 8).forEach(apply);
    const p = db.prepare("SELECT id FROM players WHERE original='전민재'").get();
    const state = JSON.stringify({
      ownership: { [p.id]: 'kbo-lg' },
      budget: 123.45,
      roster: [{ id: p.id, salary: 431, years: 5, stats: { ab: 77 }, contact: 73.5 }],
    });
    db.prepare('INSERT INTO careers(user_id,state,revision,updated_at) VALUES(?,?,?,?)').run(
      'legacy',
      state,
      81,
      '2026-09-08',
    );
    db.prepare('INSERT INTO contracts VALUES(?,?,?,?,?,?,?)').run(
      'legacy',
      p.id,
      'kbo-lg',
      431,
      5,
      2026,
      db.prepare('SELECT id FROM agents LIMIT 1').get().id,
    );
    db.prepare('INSERT INTO career_matches VALUES(?,?,?,?,?,?,?,?,?)').run(
      'legacy',
      'old-match',
      2026,
      1,
      'kbo-lg',
      'kbo-lotte',
      3,
      1,
      '{"log":["preserved"]}',
    );
    const before = ['careers', 'contracts', 'career_matches'].map((t) =>
      db.prepare('SELECT * FROM ' + t).all(),
    );
    entries.filter((e) => e.idx > 8).forEach(apply);
    assert.deepEqual(
      ['careers', 'contracts', 'career_matches'].map((t) => db.prepare('SELECT * FROM ' + t).all()),
      before,
    );
    const rating = JSON.parse(
      db.prepare('SELECT rating_json FROM players WHERE id=?').get(p.id).rating_json,
    );
    assert.equal(rating.version, 'performance-2025-v3');
    assert.equal(rating.record.bb, 22);
    const yoo = JSON.parse(
      db.prepare("SELECT rating_json FROM players WHERE original='유강남'").get().rating_json,
    );
    assert.equal(yoo.record.obp, 0.352);
    assert.equal(yoo.record.k, 66);
    const logos = JSON.parse(readFileSync('apps/api/seed/club-logos.json', 'utf8'));
    const clubs = db.prepare('SELECT id, logo_json FROM clubs').all();
    assert.equal(clubs.filter((club) => club.logo_json).length, 134);
    for (const club of clubs) {
      assert.deepEqual(JSON.parse(club.logo_json), logos[club.id] ?? null);
    }
  } finally {
    db.close();
  }
});
