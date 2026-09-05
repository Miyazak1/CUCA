import assert from "node:assert/strict";

// Freeze the old field list so additive migrations can still prove every old value survived.
export async function capturePublicDataReader(pool) {
  const tables = (await pool.query(`select c.relname as name, array_agg(a.attname::text order by a.attnum) as columns
    from pg_class c join pg_namespace n on n.oid = c.relnamespace join pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped
    group by c.relname order by c.relname`)).rows;
  assert.ok(tables.length > 0);
  const quote = name => { assert.match(name, /^[a-z][a-z0-9_]*$/); return `"${name}"`; };
  const statements = tables.map(table => [table.name, `select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), '[]'::jsonb) as data
    from (select ${table.columns.map(quote).join(", ")} from ${quote(table.name)}) t`]);
  return async () => {
    const data = {};
    for (const [table, sql] of statements) data[table] = (await pool.query(sql)).rows[0].data;
    return data;
  };
}
