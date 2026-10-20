import assert from "node:assert/strict";
import test from "node:test";
import { PostgresCatalogRepository } from "../../../src/server/index.ts";

function baseRow() {
  const now = new Date("2026-08-01T00:00:00.000Z");
  return {
    createdAt: now,
    updatedAt: now,
    status: "active",
    verificationStatus: "verified",
    sourceUrl: "https://example.edu/source",
    sourceLabel: "Official",
    sourceFieldLineageJson: { source: "official" },
    lastVerifiedAt: now,
  };
}

test("PostgresCatalogRepository uses fixed public SQL for program lists", async () => {
  const calls = [];
  const repository = new PostgresCatalogRepository({
    async query(statement, params) {
      calls.push({ statement, params });
      return [
        {
          id: "program_1",
          schoolId: "school_1",
          cityId: "city_1",
          slug: "cs",
          nameZh: "计算机科学",
          nameEn: "Computer Science",
          degreeLevel: "bachelor",
          durationYears: 4,
          durationMonths: 48,
          fieldCategory: "Computing",
          subjectArea: "Computer Science",
          teachingLanguage: "english",
          cscaSubjects: [],
          cscaRequirement: null,
          hskRequirement: null,
          englishRequirement: "IELTS 6.0",
          tuitionAmount: 30000,
          tuitionCurrency: "CNY",
          tuitionPeriod: "year",
          tuitionText: "CNY 30,000/year",
          scholarshipText: null,
          applicationUrl: "https://example.edu/apply",
          applicationNote: null,
          isVerified: true,
          hasScholarship: false,
          badgeText: null,
          displayTuition: "CNY 30k/year",
          displaySubjects: ["CS"],
          displayGroup: null,
          displayGroupLabel: null,
          sortOrder: 1,
          schoolNameEn: "Zhejiang University",
          schoolNameZh: "浙江大学",
          schoolSlug: "zju",
          citySlug: "hangzhou",
          cityNameEn: "Hangzhou",
          cityNameZh: "杭州",
          deadlineDate: new Date("2027-06-01T00:00:00.000Z"),
          deadlineLabel: "June 2027",
          applicationRound: "Fall 2027",
          createdByUserId: null,
          updatedByUserId: null,
          ...baseRow(),
        },
      ];
    },
  });

  const result = await repository.listPrograms({ limit: 10, offset: 5, query: "cs" });
  const detail = await repository.getProgram("11111111-1111-4111-8111-111111111111");

  assert.equal(result[0].name, "Computer Science");
  assert.equal(result[0].deadline, "June 2027");
  assert.deepEqual(calls[0].params, ["%cs%", 10, 5]);
  assert.doesNotMatch(calls[0].statement, /select\s+\*/i);
  assert.doesNotMatch(calls[0].statement, /source_note|quality_score|missing_fields|created_by_user_id|updated_by_user_id|tenant_settings|staff_memberships/i);
  assert.match(calls[0].statement, /where p\.status = 'active'/);
  assert.match(calls[0].statement, /p\.verification_status in \('verified','stale'\)/);
  assert.match(calls[0].statement, /coalesce\(p\.application_url,\s*case when s\.verification_status in \('verified','stale'\) then s\.admissions_url end/s);
  assert.match(calls[0].statement, /latest_intake\.deadline_date <= clock_timestamp\(\).*'expired'/s);
  assert.match(calls[0].statement, /pi\.deadline_date is null or pi\.deadline_date > clock_timestamp\(\)/);
  assert.match(calls[0].statement, /pi\.open_date is null or pi\.open_date <= clock_timestamp\(\)/);
  assert.match(calls[0].statement, /when upcoming_intake\.id is not null then 'upcoming'/);
  assert.equal(detail.slug, "cs");
  assert.deepEqual(detail.school, { id: "school_1", slug: "zju", nameZh: "浙江大学", nameEn: "Zhejiang University" });
  assert.deepEqual(detail.city, { slug: "hangzhou", nameZh: "杭州", nameEn: "Hangzhou" });
  assert.deepEqual(calls[1].params, ["11111111-1111-4111-8111-111111111111"]);
  assert.match(calls[1].statement, /join schools s on s\.id = p\.school_id and s\.status = 'active'/);
  assert.match(calls[1].statement, /left join cities c on c\.id = coalesce\(p\.city_id, s\.city_id\)/);
  assert.match(calls[1].statement, /p\.verification_status in \('verified','stale'\)/);
});

test("PostgresCatalogRepository keeps school list SQL tenant-safe", async () => {
  const calls = [];
  const repository = new PostgresCatalogRepository({
    async query(statement, params) {
      calls.push({ statement, params });
      return [];
    },
  });

  await repository.listSchools({ limit: 20, offset: 0, query: "hangzhou" });

  assert.deepEqual(calls[0].params, ["%hangzhou%", 20, 0]);
  assert.doesNotMatch(calls[0].statement, /select\s+\*/i);
  assert.doesNotMatch(calls[0].statement, /school_staff_memberships|school_applications|tenant_settings|contact_notes|fit_notes|quality_score|missing_fields|completeness_label|source_note/i);
  assert.match(calls[0].statement, /where s\.status = 'active'/);
  assert.match(calls[0].statement, /s\.verification_status in \('verified','stale'\)/);
  assert.match(calls[0].statement, /lower\(trim\(p\.teaching_language\)\).*'english'.*'english-taught'.*'英文授课'/);
  assert.doesNotMatch(calls[0].statement, /'\[\]'::jsonb as "upcomingDeadlines"/);
  assert.match(calls[0].statement, /join program_intakes pi/);
  assert.match(calls[0].statement, /p2\.verification_status in \('verified','stale'\)/);
});

test("PostgresCatalogRepository counts the same published homepage resources", async () => {
  const calls = [];
  const repository = new PostgresCatalogRepository({
    async query(statement, params) {
      calls.push({ statement, params });
      return [{ total: 9 }];
    },
  });

  assert.equal(await repository.countSchools({ query: "zhejiang" }), 9);
  assert.equal(await repository.countScholarships({ availability: "open" }), 9);
  assert.equal(await repository.countCities({ query: "hangzhou" }), 9);

  assert.match(calls[0].statement, /from schools s where s\.status = 'active'/);
  assert.match(calls[0].statement, /s\.verification_status in \('verified','stale'\)/);
  assert.deepEqual(calls[0].params, ["%zhejiang%"]);
  assert.match(calls[1].statement, /from scholarships sch/);
  assert.match(calls[1].statement, /sch\.verification_status = 'verified'/);
  assert.match(calls[1].statement, /sch\.deadline_date > clock_timestamp\(\)/);
  assert.match(calls[2].statement, /from cities c/);
  assert.match(calls[2].statement, /c\.verification_status in \('verified','stale'\)/);
  assert.match(calls[2].statement, /exists \(select 1 from schools city_school/);
  assert.deepEqual(calls[2].params, ["%hangzhou%"]);
});

test("PostgresCatalogRepository excludes scholarship contact data from public SQL", async () => {
  const calls = [];
  const repository = new PostgresCatalogRepository({
    async query(statement, params) {
      calls.push({ statement, params });
      return [];
    },
  });

  await repository.listScholarships({ limit: 20, offset: 0 });

  assert.doesNotMatch(calls[0].statement, /contact_info|source_note|verified_by_user_id|next_review_due_at/i);
  assert.match(calls[0].statement, /sch\.status = 'active'.*sch\.verification_status = 'verified'/s);
  assert.match(calls[0].statement, /left join schools s on s\.id = sch\.school_id and s\.status = 'active'/);
  assert.match(calls[0].statement, /left join programs p on p\.id = sch\.program_id and p\.status = 'active'/);
  assert.match(calls[0].statement, /order by sch\.sort_order asc, sch\.title asc, sch\.slug asc/);

  await repository.getScholarship("11111111-1111-4111-8111-111111111111");
  assert.match(calls[1].statement, /sch\.status = 'active'.*sch\.verification_status = 'verified'/s);
});

test("PostgresCatalogRepository applies program page filters to list and count queries", async () => {
  const calls = [];
  const repository = new PostgresCatalogRepository({
    async query(statement, params) {
      calls.push({ statement, params });
      return statement.startsWith("select count") ? [{ total: 42 }] : [];
    },
  });
  const options = {
    limit: 8, offset: 8, query: "computer science", degree: "master", language: "english",
    tuition: "25-40", scholarship: true, school: "zhejiang-university", sort: "deadline",
  };

  await repository.listPrograms(options);
  assert.equal(await repository.countPrograms(options), 42);
  assert.match(calls[0].statement, /p\.has_scholarship = true/);
  assert.match(calls[0].statement, /p\.tuition_amount between 25000 and 40000/);
  assert.match(calls[0].statement, /lower\(coalesce\(p\.degree_level, ''\)\) ~/);
  assert.match(calls[0].statement, /order by next_intake\.deadline_date asc nulls last/);
  assert.match(calls[1].statement, /select count\(\*\)::int as total/);
  assert.deepEqual(calls[0].params.slice(0, -2), calls[1].params);
  assert.deepEqual(calls[0].params.slice(-2), [8, 8]);
});

test("PostgresCatalogRepository applies canonical study-level filters across public resources", async () => {
  const calls = [];
  const repository = new PostgresCatalogRepository({ async query(statement, params) {
    calls.push({ statement, params });
    return statement.startsWith("select count") ? [{ total: 2 }] : [];
  } });

  await repository.listSchools({ degree: "foundation", limit: 20, offset: 0 });
  await repository.countSchools({ degree: "foundation" });
  await repository.listScholarships({ degree: "PhD", limit: 20, offset: 0 });
  await repository.countScholarships({ degree: "PhD" });

  assert.match(calls[0].statement, /exists \([\s\S]*school_program\.degree_level[\s\S]*foundation/);
  assert.match(calls[1].statement, /exists \([\s\S]*school_program\.degree_level[\s\S]*foundation/);
  assert.match(calls[2].statement, /sch\.applicable_degree[\s\S]*doctoral\|doctorate\|ph/);
  assert.match(calls[3].statement, /sch\.applicable_degree[\s\S]*doctoral\|doctorate\|ph/);
});

test("PostgresCatalogRepository can restrict application selectors to currently open intakes", async () => {
  const calls = [];
  const repo = new PostgresCatalogRepository({ async query(statement, params) {
    calls.push({ statement, params });
    return statement.startsWith("select count") ? [{ total: 346 }] : [];
  } });
  await repo.listPrograms({ applicationReady: true, limit: 100, offset: 0 });
  assert.equal(await repo.countPrograms({ applicationReady: true, limit: 100, offset: 0 }), 346);
  for (const call of calls) {
    assert.match(call.statement, /next_intake\.id is not null/);
    assert.match(call.statement, /open_date <= clock_timestamp\(\)/);
    assert.match(call.statement, /deadline_date > clock_timestamp\(\)/);
  }
});

test("PostgresCatalogRepository publishes guide cards without editorial search terms", async () => {
  const calls = [];
  const repository = new PostgresCatalogRepository({
    async query(statement, params) { calls.push({ statement, params }); return []; },
  });
  await repository.listGuides({ query: "JW form", limit: 8, offset: 0 });
  await repository.getGuide("visa-arrival");
  assert.deepEqual(calls[0].params, ["%jw%", "%form%", 8, 0]);
  assert.match(calls[0].statement, /g\.status = 'published'/);
  assert.match(calls[0].statement, /lower\(g\.search_terms::text\)/);
  assert.doesNotMatch(calls[0].statement, /search_terms\s+as|created_at|select\s+\*/i);
  assert.deepEqual(calls[1].params, ["visa-arrival"]);
  assert.match(calls[1].statement, /g\.slug = \$1 and g\.status = 'published'/);
});

test("PostgresCatalogRepository computes city coverage and enforces publication gates", async () => {
  const calls = [];
  const repository = new PostgresCatalogRepository({ async query(statement, params) { calls.push({ statement, params }); return []; } });
  await repository.listCities({ query: "beijing", limit: 20, offset: 0 });
  await repository.getCity("beijing");

  for (const call of calls) {
    assert.match(call.statement, /actualSchoolCount/);
    assert.match(call.statement, /actualProgramCount/);
    assert.match(call.statement, /actualEnglishProgramCount/);
    assert.match(call.statement, /actualScholarshipCount/);
    assert.match(call.statement, /actualCscaRequiredSchoolCount/);
    assert.match(call.statement, /actualOpenIntakeCount/);
    assert.match(call.statement, /verification_status in \('verified','stale'\)/);
    assert.match(call.statement, /slug !~ '\^local-'/);
    assert.match(call.statement, /exists \(select 1 from schools city_school/);
    assert.doesNotMatch(call.statement, /select\s+\*/i);
  }
});
