import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { PostgresMaterialSelection } from "../../../src/server/student/postgres-material-selection.ts";
import { materialPreviewFixture } from "./application-material-preview-fixture.mjs";

export const emptySelection = () => ({ applicantFields: [], educationRecordIds: [], assessmentRecordIds: [] });
export async function materialSelectionFixture(pool, userId, populated = true, options = {}) {
  const f = await materialPreviewFixture(pool, userId, populated, options), selectionService = new PostgresMaterialSelection(f.client);
  return { ...f, selectionService, selectionPath: f.materialPath.replace("/material-preview", "/material-selection"),
    selectionInput: { expectedRevision: 0, ...f.input },
    selectionGet: (service = selectionService) => service.get(f.context, f.set.id, f.choice.id),
    selectionPut: (input = { expectedRevision: 0, ...f.input }, service = selectionService) => service.put(f.context, f.set.id, f.choice.id, input) };
}

export function gateSelectionClient(client, predicate) {
  let release, reached, timer, paused = false;
  const gate = new Promise(resolve => { release = resolve; });
  const ready = new Promise((resolve, reject) => { reached = pid => { clearTimeout(timer); resolve(pid); };
    timer = setTimeout(() => reject(new Error("Selection transaction did not reach its barrier.")), 5000); });
  return { ready, release() { clearTimeout(timer); release(); }, client: { ...client, transaction: work => client.transaction(tx => work({ ...tx,
    async query(sql, params) { const rows = await tx.query(sql, params);
      if (!paused && predicate(sql)) { paused = true; reached((await tx.query("select pg_backend_pid() as pid", []))[0].pid); await gate; }
      return rows;
    },
  })) } };
}

export async function waitForSelectionBlock(pool, pid, count = 1) {
  for (let i = 0; i < 250; i++) {
    const rows = (await pool.query(`select pid from pg_stat_activity where datname = current_database()
      and state = 'active' and wait_event_type = 'Lock' and $1 = any(pg_blocking_pids(pid))`, [pid])).rows;
    if (rows.length >= count) return;
    await delay(10);
  }
  assert.fail("Selection race did not reach a real database lock wait.");
}
