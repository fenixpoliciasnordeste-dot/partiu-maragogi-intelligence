import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
test("PostgreSQL migration, search and immutable snapshots", async () => {
  const pg = new PGlite({ extensions: { pg_trgm } });
  try {
    await pg.exec(
      await readFile(
        "prisma/migrations/202609090001_init/migration.sql",
        "utf8",
      ),
    );
    await pg.exec(
      `INSERT INTO "SocialProfile" (id,platform,"externalId",name,username) VALUES ('p','Instagram','external-test','TEST FIXTURE','test');INSERT INTO "ProfileSnapshot" (id,"profileId",platform,followers) VALUES ('s1','p','Instagram',NULL),('s2','p','Instagram',0);INSERT INTO "SocialPost" (id,"externalId","profileId",platform,caption,format,"publishedAt") VALUES ('post','test-post','p','Instagram','Quanto custa conhecer as piscinas naturais de Maragogi?','Reel',NOW());`,
    );
    assert.equal(
      (await pg.query(`SELECT * FROM "ProfileSnapshot"`)).rows.length,
      2,
    );
    await assert.rejects(
      () => pg.exec(`UPDATE "ProfileSnapshot" SET followers=12 WHERE id='s1'`),
      /append-only/,
    );
    await assert.rejects(
      () => pg.exec(`DELETE FROM "ProfileSnapshot" WHERE id='s2'`),
      /append-only/,
    );
    const result = await pg.query(
      `SELECT id FROM "SocialPost" WHERE to_tsvector('portuguese',caption) @@ websearch_to_tsquery('portuguese','piscinas Maragogi')`,
    );
    assert.equal(result.rows.length, 1);
    await pg.exec(
      `INSERT INTO "PostSnapshot" (id,"postId",views) VALUES ('ps1','post',NULL),('ps2','post',100)`,
    );
    await assert.rejects(
      () => pg.exec(`DELETE FROM "PostSnapshot"`),
      /append-only/,
    );
    await pg.exec(
      `INSERT INTO "SyncJob" (id,target) VALUES ('job','main:Instagram')`,
    );
    const claim = await pg.query(
      `UPDATE "SyncJob" SET status='RUNNING',"startedAt"=NOW() WHERE id=(SELECT id FROM "SyncJob" WHERE status='QUEUED' ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id`,
    );
    assert.equal(claim.rows.length, 1);
    const second = await pg.query(
      `SELECT id FROM "SyncJob" WHERE status='QUEUED'`,
    );
    assert.equal(second.rows.length, 0);
  } finally {
    await pg.close();
  }
});
