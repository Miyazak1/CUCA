import { PostgresApplicationMaterialPreview } from "../../../src/server/student/postgres-application-material-preview.ts";
import { preflightFixture } from "./application-preflight-fixture.mjs";

export async function materialPreviewFixture(pool, existingUserId, populated = true, options = {}) {
  const f = await preflightFixture(pool, existingUserId, options), reader = new PostgresApplicationMaterialPreview(f.client);
  if (populated) await f.populate();
  async function request() {
    const versions = options.readVersionsDirectly
      ? (await pool.query(`select a.revision as "applicationSet", coalesce(ap.revision, 0) as applicant,
          coalesce(e.revision, 0) as education, coalesce(h.revision, 0) as assessments
          from application_sets a
          left join student_applicant_profiles ap on ap.user_id = a.user_id
          left join student_education_histories e on e.user_id = a.user_id
          left join student_assessment_histories h on h.user_id = a.user_id
          where a.id = $1 and a.user_id = $2`, [f.set.id, f.userId])).rows[0]
      : null;
    const report = versions ? null : await f.get();
    const education = (await pool.query("select id from student_education_records where user_id = $1 and removed_at is null order by id", [f.userId])).rows;
    const assessments = (await pool.query("select id from student_assessment_records where user_id = $1 and removed_at is null order by id", [f.userId])).rows;
    return { expectedVersions: versions ?? { applicationSet: report.revision, applicant: report.preparation.applicant.revision,
      education: report.preparation.education.revision, assessments: report.preparation.assessments.revision },
    selection: { applicantFields: ["fullName", "contactEmail", "citizenshipCountry"], educationRecordIds: education.map(r => r.id), assessmentRecordIds: assessments.map(r => r.id) } };
  }
  const input = await request();
  return { ...f, materialReader: reader, input, request, materialPath: f.path.replace("/preflight?locale=en", "/material-preview"),
    preview: (value = input, service = reader) => service.preview(f.context, f.set.id, f.choice.id, value) };
}
