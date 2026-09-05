import type { SqlCatalogClient } from "./postgres-repository.ts";
import {
  createCatalogSeedImportPlan,
  type CatalogSeedBundle,
  type CatalogSeedImportEntityType,
  type CatalogSeedSource,
} from "./seed-contract.ts";

export type CatalogSeedWriteResult = {
  ok: boolean;
  errors: string[];
  summary: {
    cities: number;
    schools: number;
    programs: number;
    scholarships: number;
    evidence: number;
  };
  written: {
    entityType: CatalogSeedImportEntityType;
    slug: string;
    id: string;
  }[];
};

export class CatalogSeedWriter {
  private readonly client: SqlCatalogClient;

  constructor(client: SqlCatalogClient) {
    this.client = client;
  }

  async writeBundle(bundle: unknown): Promise<CatalogSeedWriteResult> {
    const plan = createCatalogSeedImportPlan(bundle);

    if (!plan.ok) {
      return {
        ok: false,
        errors: plan.errors,
        summary: {
          ...plan.summary,
          evidence: 0,
        },
        written: [],
      };
    }

    const seedBundle = bundle as CatalogSeedBundle;
    const written: CatalogSeedWriteResult["written"] = [];
    let evidence = 0;

    for (const city of seedBundle.cities ?? []) {
      const id = await this.upsertCity(city);
      await this.writeSourceEvidence("city", id, city);
      written.push({ entityType: "city", slug: city.slug, id });
      evidence += 1;
    }

    for (const school of seedBundle.schools ?? []) {
      const id = await this.upsertSchool(school);
      await this.writeSourceEvidence("school", id, school);
      written.push({ entityType: "school", slug: school.slug, id });
      evidence += 1;
    }

    for (const program of seedBundle.programs ?? []) {
      const id = await this.upsertProgram(program);
      await this.writeSourceEvidence("program", id, program);
      written.push({ entityType: "program", slug: program.slug, id });
      evidence += 1;
    }

    for (const scholarship of seedBundle.scholarships ?? []) {
      const id = await this.upsertScholarship(scholarship);
      await this.writeSourceEvidence("scholarship", id, scholarship);
      written.push({ entityType: "scholarship", slug: scholarship.slug, id });
      evidence += 1;
    }

    return {
      ok: true,
      errors: [],
      summary: {
        ...plan.summary,
        evidence,
      },
      written,
    };
  }

  private async upsertCity(city: NonNullable<CatalogSeedBundle["cities"]>[number]): Promise<string> {
    const rows = await this.client.query<{ id: string }>(
      `insert into cities (
         slug, name_zh, name_en, region, province, status, source_url, source_label, source_field_lineage_json
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       on conflict (slug) do update set
         name_zh = excluded.name_zh,
         name_en = excluded.name_en,
         region = excluded.region,
         province = excluded.province,
         status = excluded.status,
         source_url = excluded.source_url,
         source_label = excluded.source_label,
         source_field_lineage_json = excluded.source_field_lineage_json,
         updated_at = now()
       returning id`,
      [
        city.slug,
        city.nameZh ?? null,
        city.nameEn,
        city.region ?? null,
        city.province ?? null,
        city.status ?? "draft",
        city.sourceUrl,
        city.sourceLabel,
        JSON.stringify(city.sourceFieldLineage ?? {}),
      ],
    );

    return requireReturnedId(rows, "city", city.slug);
  }

  private async upsertSchool(school: NonNullable<CatalogSeedBundle["schools"]>[number]): Promise<string> {
    const rows = await this.client.query<{ id: string }>(
      `insert into schools (
         slug, name_zh, name_en, school_type, region, city_id, city_slug, status, source_url, source_label, source_field_lineage_json
       ) values ($1, $2, $3, $4, $5, (select id from cities where slug = $6), $6, $7, $8, $9, $10::jsonb)
       on conflict (slug) do update set
         name_zh = excluded.name_zh,
         name_en = excluded.name_en,
         school_type = excluded.school_type,
         region = excluded.region,
         city_id = excluded.city_id,
         city_slug = excluded.city_slug,
         status = excluded.status,
         source_url = excluded.source_url,
         source_label = excluded.source_label,
         source_field_lineage_json = excluded.source_field_lineage_json,
         updated_at = now()
       returning id`,
      [
        school.slug,
        school.nameZh ?? null,
        school.nameEn,
        school.schoolType ?? null,
        school.region ?? null,
        school.citySlug ?? null,
        school.status ?? "draft",
        school.sourceUrl,
        school.sourceLabel,
        JSON.stringify(school.sourceFieldLineage ?? {}),
      ],
    );

    return requireReturnedId(rows, "school", school.slug);
  }

  private async upsertProgram(program: NonNullable<CatalogSeedBundle["programs"]>[number]): Promise<string> {
    const rows = await this.client.query<{ id: string }>(
      `insert into programs (
         slug, school_id, name_zh, name_en, degree_level, teaching_language, tuition_text, status, source_url, source_label, source_field_lineage_json
       ) values ($1, (select id from schools where slug = $2), $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
       on conflict (slug) do update set
         school_id = excluded.school_id,
         name_zh = excluded.name_zh,
         name_en = excluded.name_en,
         degree_level = excluded.degree_level,
         teaching_language = excluded.teaching_language,
         tuition_text = excluded.tuition_text,
         status = excluded.status,
         source_url = excluded.source_url,
         source_label = excluded.source_label,
         source_field_lineage_json = excluded.source_field_lineage_json,
         updated_at = now()
       returning id`,
      [
        program.slug,
        program.schoolSlug,
        program.nameZh ?? null,
        program.nameEn,
        program.degreeLevel,
        program.teachingLanguage ?? null,
        program.tuitionText ?? null,
        program.status ?? "draft",
        program.sourceUrl,
        program.sourceLabel,
        JSON.stringify(program.sourceFieldLineage ?? {}),
      ],
    );

    return requireReturnedId(rows, "program", program.slug);
  }

  private async upsertScholarship(scholarship: NonNullable<CatalogSeedBundle["scholarships"]>[number]): Promise<string> {
    const rows = await this.client.query<{ id: string }>(
      `insert into scholarships (
         slug, title, school_id, program_id, provider_name, funding_level, amount_text, status, source_url, source_label, source_field_lineage_json
       ) values (
         $1, $2,
         (select id from schools where slug = $3),
         (select id from programs where slug = $4),
         $5, $6, $7, $8, $9, $10, $11::jsonb
       )
       on conflict (slug) do update set
         title = excluded.title,
         school_id = excluded.school_id,
         program_id = excluded.program_id,
         provider_name = excluded.provider_name,
         funding_level = excluded.funding_level,
         amount_text = excluded.amount_text,
         status = excluded.status,
         source_url = excluded.source_url,
         source_label = excluded.source_label,
         source_field_lineage_json = excluded.source_field_lineage_json,
         updated_at = now()
       returning id`,
      [
        scholarship.slug,
        scholarship.title,
        scholarship.schoolSlug ?? null,
        scholarship.programSlug ?? null,
        scholarship.providerName ?? null,
        scholarship.fundingLevel ?? null,
        scholarship.amountText ?? null,
        scholarship.status ?? "draft",
        scholarship.sourceUrl,
        scholarship.sourceLabel,
        JSON.stringify(scholarship.sourceFieldLineage ?? {}),
      ],
    );

    return requireReturnedId(rows, "scholarship", scholarship.slug);
  }

  private async writeSourceEvidence(entityType: CatalogSeedImportEntityType, entityId: string, source: CatalogSeedSource): Promise<void> {
    await this.client.query(
      `insert into catalog_source_evidence (
         entity_type, entity_id, source_url, source_label, captured_at, source_field_lineage_json, metadata_json
       )
       select $1, $2, $3, $4, coalesce($5::timestamptz, now()), $6::jsonb, $7::jsonb
       where not exists (
         select 1
         from catalog_source_evidence
         where entity_type = $1
           and entity_id = $2
           and source_url is not distinct from $3
           and source_label is not distinct from $4
       )`,
      [
        entityType,
        entityId,
        source.sourceUrl,
        source.sourceLabel,
        source.capturedAt ?? null,
        JSON.stringify(source.sourceFieldLineage ?? {}),
        JSON.stringify({ importSource: "catalog_seed_writer_v1" }),
      ],
    );
  }
}

function requireReturnedId(rows: readonly { id: string }[], entityType: CatalogSeedImportEntityType, slug: string): string {
  if (!rows[0]?.id) {
    throw new Error(`Catalog seed upsert did not return an id for ${entityType}:${slug}.`);
  }

  return rows[0].id;
}
