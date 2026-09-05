import { isDeepStrictEqual } from "node:util";

// Compare PostgreSQL's parsed definitions, not SQL text or physical column order.
export async function readPublicSchemaCatalog(client) {
  const queries = {
    tables: `select c.relname as name, c.relkind, c.relpersistence, c.relrowsecurity, c.relforcerowsecurity,
      c.relreplident, c.reloptions, pg_get_partkeydef(c.oid) as partition_key
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r','p') order by c.relname`,
    columns: `select c.relname || '.' || a.attname as name, format_type(a.atttypid, a.atttypmod) as type,
      a.attnotnull, a.attidentity, a.attgenerated, a.attcollation::regcollation::text as collation,
      pg_get_expr(d.adbin, d.adrelid) as default_expression
      from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
      left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
      where n.nspname = 'public' and c.relkind in ('r','p') and a.attnum > 0 and not a.attisdropped
      order by c.relname, a.attname`,
    constraints: `select c.relname || '.' || k.conname as name, k.contype, k.condeferrable, k.condeferred, k.convalidated,
      pg_get_constraintdef(k.oid) as definition from pg_constraint k
      join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' order by c.relname, k.conname`,
    indexes: `select x.relname as name, i.indisvalid, i.indisready, i.indislive, i.indisunique, i.indnullsnotdistinct,
      x.reloptions, pg_get_indexdef(i.indexrelid) as definition
      from pg_index i join pg_class c on c.oid = i.indrelid join pg_namespace n on n.oid = c.relnamespace
      join pg_class x on x.oid = i.indexrelid where n.nspname = 'public' order by x.relname`,
    triggers: `select c.relname || '.' || t.tgname as name, t.tgenabled, pg_get_triggerdef(t.oid) as definition
      from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and not t.tgisinternal order by c.relname, t.tgname`,
    views: `select c.relname as name, c.relkind, c.reloptions, pg_get_viewdef(c.oid) as definition
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('v','m') order by c.relname`,
    enums: `select t.typname as name, jsonb_agg(e.enumlabel order by e.enumsortorder) as labels
      from pg_type t join pg_namespace n on n.oid = t.typnamespace join pg_enum e on e.enumtypid = t.oid
      where n.nspname = 'public' group by t.typname order by t.typname`,
    sequences: `select c.relname as name, s.seqtypid::regtype::text as type, s.seqstart::text, s.seqincrement::text,
      s.seqmax::text, s.seqmin::text, s.seqcache::text, s.seqcycle from pg_sequence s
      join pg_class c on c.oid = s.seqrelid join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' order by c.relname`,
    policies: `select tablename || '.' || policyname as name, permissive, roles, cmd, qual, with_check
      from pg_policies where schemaname = 'public' order by tablename, policyname`,
    functions: `select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as name,
      pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prokind in ('f','p','w') order by name`,
    otherSchemas: `select nspname as name from pg_namespace
      where left(nspname, 3) <> 'pg_' and nspname not in ('information_schema','public','drizzle') order by nspname`,
  };
  const catalog = {};
  for (const [kind, sql] of Object.entries(queries)) {
    catalog[kind] = Object.fromEntries((await client.query(sql)).rows.map(row => [row.name, row]));
  }
  return catalog;
}

export function schemaCatalogDifferences(actual, expected) {
  const differences = [];
  for (const kind of new Set([...Object.keys(actual), ...Object.keys(expected)])) {
    for (const name of new Set([...Object.keys(actual[kind] ?? {}), ...Object.keys(expected[kind] ?? {})])) {
      if (!isDeepStrictEqual(actual[kind]?.[name], expected[kind]?.[name])) {
        differences.push({ kind, name, migrated: actual[kind]?.[name] ?? null, declared: expected[kind]?.[name] ?? null });
      }
    }
  }
  return differences;
}
