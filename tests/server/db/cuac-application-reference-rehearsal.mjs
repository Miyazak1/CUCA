import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PostgresStudentCoreRepository } from "../../../src/server/student/postgres-repository.ts";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";

export async function runCuacApplicationReferenceRehearsal(t, pool) {
  await t.test("concurrent Application Set creation allocates stable unique annual CUAC IDs", async () => {
    const email = `cuac-reference-${randomUUID()}@example.invalid`;
    const user = (await pool.query(
      "insert into users (email,email_normalized) values ($1,$1) returning id",
      [email],
    )).rows[0];
    const repository = new PostgresStudentCoreRepository(createTransactionalSqlClient(pool));

    try {
      const created = await Promise.all(Array.from({ length: 12 }, (_, index) =>
        repository.createApplicationSet(user.id, {
          name: `Concurrent reference ${index + 1}`,
          targetIntake: "fall-2027",
        })));
      const databaseYear = Number((await pool.query(
        "select extract(year from clock_timestamp() at time zone 'UTC')::integer as year",
      )).rows[0].year);
      const expectedPrefix = `CUAC-${String(databaseYear).padStart(4, "0")}-`;
      const references = created.map((applicationSet) => applicationSet.cuacId);

      assert.equal(new Set(references).size, created.length);
      assert.ok(references.every((reference) => typeof reference === "string"
        && reference.startsWith(expectedPrefix)
        && /^CUAC-[0-9]{4}-[0-9]{6}$/.test(reference)));
      const sequences = references.map((reference) => Number(reference.slice(-6))).sort((a, b) => a - b);
      assert.deepEqual(sequences, Array.from({ length: sequences.length }, (_, index) => sequences[0] + index));
      assert.ok(created.every((applicationSet) => !applicationSet.cuacId.includes(applicationSet.id.replaceAll("-", ""))));

      const reread = await repository.listApplicationSetsByUserId(user.id);
      assert.deepEqual(new Set(reread.map((applicationSet) => applicationSet.cuacId)), new Set(references));
      const persisted = await pool.query(
        `select cuac_id,cuac_reference_year,cuac_reference_sequence
         from application_sets where user_id = $1 order by cuac_reference_sequence`,
        [user.id],
      );
      assert.deepEqual(persisted.rows.map((row) => row.cuac_id),
        [...references].sort((a, b) => Number(a.slice(-6)) - Number(b.slice(-6))));
      assert.ok(persisted.rows.every((row) => row.cuac_reference_year === databaseYear));
    } finally {
      await pool.query("delete from users where id = $1", [user.id]);
    }
  });
}
