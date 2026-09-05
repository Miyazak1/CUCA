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
  assert.equal(detail.slug, "cs");
  assert.deepEqual(detail.school, { id: "school_1", slug: "zju", nameZh: "浙江大学", nameEn: "Zhejiang University" });
  assert.deepEqual(detail.city, { slug: "hangzhou", nameZh: "杭州", nameEn: "Hangzhou" });
  assert.deepEqual(calls[1].params, ["11111111-1111-4111-8111-111111111111"]);
  assert.match(calls[1].statement, /join schools s on s\.id = p\.school_id and s\.status = 'active'/);
  assert.match(calls[1].statement, /left join cities c on c\.id = coalesce\(p\.city_id, s\.city_id\)/);
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
  assert.doesNotMatch(calls[0].statement, /'\[\]'::jsonb as "upcomingDeadlines"/);
  assert.match(calls[0].statement, /join program_intakes pi/);
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
  assert.match(calls[0].statement, /left join schools s on s\.id = sch\.school_id and s\.status = 'active'/);
  assert.match(calls[0].statement, /left join programs p on p\.id = sch\.program_id and p\.status = 'active'/);
});
