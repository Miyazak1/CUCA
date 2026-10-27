import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = {
  id: string;
  label: string;
  url: string;
  finalUrl?: string;
  fetchedAt: string;
  status: number;
  sha256: string;
  artifactPath: string;
};

type Route = readonly [
  degreeLevel: "Master" | "Doctoral",
  code: string,
  name: string,
  language: "Chinese" | "English" | undefined,
  durationYears: number,
  degreeType: "Academic" | "Professional",
];

const root = process.cwd();
const expected = new Map<string, string>([
  ["xjtu-master-program-index-2027", "14b28db297a4295f2aca7ae00a9c6b26236e8d5ebd4c55d7e700a4ade6d90fbc"],
  ["xjtu-master-program-list-2027", "a630446f0007e01515daadf7cb4754a418a48cf0851ad3802d09b1b63b1f7aca"],
  ["xjtu-doctoral-program-index-2027", "b9c412c5ccb1e58c7db9773782a7c98860e014d4fa272a2d3a728220b4060836"],
  ["xjtu-doctoral-program-list-2027", "5fab453912a326e326e8099e40a3aadc9c19ccfcf377de8790ca1623bc572c9f"],
  ["xjtu-eligibility-and-application-documents-current", "dcb3709af4d0b31f7ae0ad070d99f24810bf15a29575f7b8f71ab0c3f9815c1a"],
]);
const evidence = new Map<string, ManifestSource>();

for (const entry of await readdir(resolve(root, "work/catalog-official"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(root, "work/catalog-official", entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    for (const row of manifest.sources ?? []) {
      if (row.status !== 200 || expected.get(row.id) !== row.sha256) continue;
      const bytes = await readFile(resolve(runRoot, row.artifactPath));
      if (createHash("sha256").update(bytes).digest("hex") !== row.sha256) throw new Error(`XJTU Wave 55 evidence hash mismatch for ${row.id}.`);
      evidence.set(row.id, row);
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
if (evidence.size !== expected.size) throw new Error(`Missing locked XJTU Wave 55 evidence: found ${evidence.size}/${expected.size}.`);

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-08.draft.json"), "utf8")) as CatalogSeedBundle;
const school = dependency.schools?.find((row) => row.slug === "xi-an-jiaotong-university");
const city = dependency.cities?.find((row) => row.slug === "xian");
if (!school || !city) throw new Error("Wave 55 XJTU dependencies are incomplete.");

const routes: Route[] = [
  ["Master", "080700", "Power Engineering and Engineering Thermophysics", "English", 2, "Academic"],
  ["Master", "082700", "Nuclear Science and Technology", "English", 2, "Academic"],
  ["Master", "083000", "Environmental Science and Engineering", "English", 2, "Academic"],
  ["Master", "080800", "Electrical Engineering", "English", 2, "Academic"],
  ["Master", "080200", "Mechanical Engineering", "English", 2, "Academic"],
  ["Master", "080100", "Mechanics", "English", 3, "Academic"],
  ["Master", "082500", "Aeronautical and Astronautical Science and Technology", "English", 3, "Academic"],
  ["Master", "080500", "Materials Science and Engineering", "Chinese", 3, "Academic"],
  ["Master", "080900", "Electronic Science and Technology", "English", 3, "Academic"],
  ["Master", "081200", "Computer Science and Technology", "English", 2, "Academic"],
  ["Master", "081000", "Information and Communication Engineering", "English", 2, "Academic"],
  ["Master", "081110", "Control Science and Engineering", "English", 2, "Academic"],
  ["Master", "080900", "Electronic Science and Technology", "English", 2, "Academic"],
  ["Master", "083900", "Cyberspace Security", "Chinese", 3, "Academic"],
  ["Master", "081700", "Chemical Engineering and Technology", "English", 3, "Academic"],
  ["Master", "080700", "Power Engineering and Engineering Thermophysics", "English", 3, "Academic"],
  ["Master", "080400", "Instrument Science and Technology", "Chinese", 3, "Academic"],
  ["Master", "083100", "Biomedical Engineering", "English", 3, "Academic"],
  ["Master", "071000", "Biology", "English", 3, "Academic"],
  ["Master", "083000", "Environment Science and Engineering", "Chinese", 3, "Academic"],
  ["Master", "085701", "Environmental Engineering", "English", 2.5, "Professional"],
  ["Master", "081400", "Civil Engineering", "Chinese", 3, "Academic"],
  ["Master", "081300", "Architecture", "Chinese", 3, "Academic"],
  ["Master", "070200", "Physics", "Chinese", 3, "Academic"],
  ["Master", "070300", "Chemistry", "English", 3, "Academic"],
  ["Master", "080500", "Materials Science and Engineering", "English", 3, "Academic"],
  ["Master", "120200", "Business Administration", "English", 2, "Academic"],
  ["Master", "120400", "Public Administration", "English", 3, "Academic"],
  ["Master", "020200", "Applied Economics", "English", 2, "Academic"],
  ["Master", "030100", "Law", "English", 2, "Academic"],
  ["Master", "030100", "Law", "Chinese", 3, "Academic"],
  ["Master", "050300", "Journalism and Communication Master of Arts in Chinese Culture Studies", "Chinese", 2, "Academic"],
  ["Master", "010100", "Philosophy", "Chinese", 3, "Academic"],
  ["Master", "030300", "Sociology", "Chinese", 3, "Academic"],
  ["Master", "050300", "Journalism and Communication", "Chinese", 3, "Academic"],
  ["Master", "140300", "Design Studies", "Chinese", 3, "Academic"],
  ["Master", "050200", "Foreign Languages and Literatures", "Chinese", 3, "Academic"],
  ["Master", "045300", "International Chinese Language Education", "Chinese", 3, "Professional"],
  ["Master", "100101", "Human Anatomy, Histology and Embryology", "English", 3, "Academic"],
  ["Master", "100102", "Immunology", "English", 3, "Academic"],
  ["Master", "100103", "Microbiology", "English", 3, "Academic"],
  ["Master", "100104", "Pathology and Pathophysiology", "English", 3, "Academic"],
  ["Master", "100401", "Epidemiology and Health Statistics", "English", 3, "Academic"],
  ["Master", "100402", "Occupational and Environmental Health", "English", 3, "Academic"],
  ["Master", "100404", "Maternal, Child and Adolescent Health", "English", 3, "Academic"],
  ["Master", "101200", "Forensic Medicine", "English", 3, "Academic"],
  ["Master", "101100", "Nursing", "English", 3, "Academic"],
  ["Master", "100700", "Pharmacy", "English", 3, "Academic"],
  ["Master", "105200", "Stomatological Medicine", "English", 3, "Professional"],
  ["Master", "105101", "Internal Medicine", "English", 3, "Professional"],
  ["Master", "105102", "Pediatrics", "English", 3, "Professional"],
  ["Master", "105103", "Geriatrics", "English", 3, "Professional"],
  ["Master", "105104", "Neurology", "English", 3, "Professional"],
  ["Master", "105105", "Psychiatry and Mental Health", "English", 3, "Professional"],
  ["Master", "105106", "Dermatology and Venereology", "English", 3, "Professional"],
  ["Master", "105107", "Emergency Medicine", "English", 3, "Professional"],
  ["Master", "105108", "Critical Care Medicine", "English", 3, "Professional"],
  ["Master", "105109", "General Family Medicine", "English", 3, "Professional"],
  ["Master", "105110", "Rehabilitation Medicine and Physical Therapy", "English", 3, "Professional"],
  ["Master", "105111", "Surgery", "English", 3, "Professional"],
  ["Master", "105112", "Pediatric Surgery", "English", 3, "Professional"],
  ["Master", "105113", "Orthopedics", "English", 3, "Professional"],
  ["Master", "105115", "Obstetrics and Gynecology", "English", 3, "Professional"],
  ["Master", "105116", "Ophthalmology", "English", 3, "Professional"],
  ["Master", "105117", "Otorhinolaryngology", "English", 3, "Professional"],
  ["Master", "105118", "Anesthesiology", "English", 3, "Professional"],
  ["Master", "105119", "Clinical Pathology", "English", 3, "Professional"],
  ["Master", "105120", "Clinical Laboratory Diagnostics", "English", 3, "Professional"],
  ["Master", "105121", "Oncology", "English", 3, "Professional"],
  ["Master", "105122", "Radiation Oncology", "English", 3, "Professional"],
  ["Master", "105123", "Radiology", "English", 3, "Professional"],
  ["Master", "105124", "Ultrasound Medicine", "English", 3, "Professional"],
  ["Master", "105125", "Nuclear Medicine", "English", 3, "Professional"],
  ["Doctoral", "080700", "Power Engineering and Engineering Thermophysics", "English", 3, "Academic"],
  ["Doctoral", "082700", "Nuclear Science and Technology", "English", 3, "Academic"],
  ["Doctoral", "083000", "Environmental Science and Engineering", "English", 3, "Academic"],
  ["Doctoral", "080800", "Electrical Engineering", "English", 3, "Academic"],
  ["Doctoral", "080200", "Mechanical Engineering", "English", 3, "Academic"],
  ["Doctoral", "080100", "Mechanics", "English", 4, "Academic"],
  ["Doctoral", "082500", "Aeronautical and Astronautical Science and Technology", "English", 4, "Academic"],
  ["Doctoral", "080500", "Materials Science and Engineering", "Chinese", 4, "Academic"],
  ["Doctoral", "080900", "Electronic Science and Technology", "English", 4, "Academic"],
  ["Doctoral", "081200", "Computer Science and Technology", "English", 3, "Academic"],
  ["Doctoral", "081000", "Information and Communication Engineering", "English", 3, "Academic"],
  ["Doctoral", "081110", "Control Science and Engineering", "English", 3, "Academic"],
  ["Doctoral", "081200", "Computer Science and Technology", "Chinese", 4, "Academic"],
  ["Doctoral", "080900", "Electronic Science and Technology", "English", 3, "Academic"],
  ["Doctoral", "083900", "Cyberspace Security", "Chinese", 3, "Academic"],
  ["Doctoral", "081700", "Chemical Engineering and Technology", "English", 4, "Academic"],
  ["Doctoral", "080700", "Power Engineering and Engineering Thermophysics", "English", 4, "Academic"],
  ["Doctoral", "080400", "Instrument Science and Technology", "English", 4, "Academic"],
  ["Doctoral", "083100", "Biomedical Engineering", "English", 4, "Academic"],
  ["Doctoral", "071000", "Biology", "English", 4, "Academic"],
  ["Doctoral", "083000", "Environment Science and Engineering", "Chinese", 4, "Academic"],
  ["Doctoral", "081400", "Civil Engineering", "Chinese", 4, "Academic"],
  ["Doctoral", "081300", "Architecture", "Chinese", 4, "Academic"],
  ["Doctoral", "070100", "Mathematics", "Chinese", 4, "Academic"],
  ["Doctoral", "071400", "Statistics", "Chinese", 4, "Academic"],
  ["Doctoral", "070200", "Physics", "Chinese", 4, "Academic"],
  ["Doctoral", "070300", "Chemistry", "English", 4, "Academic"],
  ["Doctoral", "070200", "Physics", "English", 4, "Academic"],
  ["Doctoral", "080500", "Materials Science and Engineering", "English", 4, "Academic"],
  ["Doctoral", "120200", "Business Administration", "English", 3, "Academic"],
  ["Doctoral", "120400", "Public Administration", "English", 4, "Academic"],
  ["Doctoral", "020200", "Applied Economics", "English", 3, "Academic"],
  ["Doctoral", "030100", "Law", "English", 3, "Academic"],
  ["Doctoral", "030100", "Law", "Chinese", 3, "Academic"],
  ["Doctoral", "140300", "Design Studies", "Chinese", 4, "Academic"],
  ["Doctoral", "030300", "Sociology", "Chinese", 4, "Academic"],
  ["Doctoral", "010100", "Philosophy", "Chinese", 4, "Academic"],
  ["Doctoral", "050200", "Foreign Languages and Literatures", "Chinese", 4, "Academic"],
  ["Doctoral", "050300", "Journalism and Communication", "Chinese", 3, "Academic"],
  ["Doctoral", "100101", "Human Anatomy, Histology and Embryology", "English", 4, "Academic"],
  ["Doctoral", "100102", "Immunology", "English", 4, "Academic"],
  ["Doctoral", "100103", "Microbiology", "English", 4, "Academic"],
  ["Doctoral", "100104", "Pathology and Pathophysiology", "English", 4, "Academic"],
  ["Doctoral", "100700", "Pharmacy", "English", 4, "Academic"],
  ["Doctoral", "100401", "Epidemiology and Health Statistics", "English", 4, "Academic"],
  ["Doctoral", "100402", "Occupational and Environmental Health", undefined, 4, "Academic"],
  ["Doctoral", "100404", "Maternal, Child and Adolescent Health", "English", 4, "Academic"],
  ["Doctoral", "101200", "Forensic Medicine", "English", 4, "Academic"],
  ["Doctoral", "101100", "Nursing", "English", 4, "Academic"],
  ["Doctoral", "100701", "Medicinal Chemistry", "English", 4, "Academic"],
  ["Doctoral", "100702", "Pharmaceutics", "English", 4, "Academic"],
  ["Doctoral", "100703", "Pharmacognosy", "English", 4, "Academic"],
  ["Doctoral", "100704", "Pharmaceutical Analysis", "English", 4, "Academic"],
  ["Doctoral", "100706", "Pharmacology", "English", 4, "Academic"],
  ["Doctoral", "105200", "Stomatological Medicine", "English", 3, "Professional"],
  ["Doctoral", "105101", "Internal Medicine", "English", 3, "Professional"],
  ["Doctoral", "105102", "Pediatrics", "English", 3, "Professional"],
  ["Doctoral", "105103", "Geriatrics", "English", 3, "Professional"],
  ["Doctoral", "105104", "Neurology", "English", 3, "Professional"],
  ["Doctoral", "105108", "Critical Care Medicine", "English", 3, "Professional"],
  ["Doctoral", "105109", "General Family Medicine", "English", 3, "Professional"],
  ["Doctoral", "105110", "Rehabilitation Medicine and Physical Therapy", "English", 3, "Professional"],
  ["Doctoral", "105111", "Surgery", "English", 3, "Professional"],
  ["Doctoral", "105113", "Orthopedics", "English", 3, "Professional"],
  ["Doctoral", "105115", "Obstetrics and Gynecology", "English", 3, "Professional"],
  ["Doctoral", "105116", "Ophthalmology", "English", 3, "Professional"],
  ["Doctoral", "105117", "Otorhinolaryngology", "English", 3, "Professional"],
  ["Doctoral", "105118", "Anesthesiology", "English", 3, "Professional"],
  ["Doctoral", "105120", "Clinical Laboratory Diagnostics", "English", 3, "Professional"],
  ["Doctoral", "105121", "Oncology", "English", 3, "Professional"],
  ["Doctoral", "105122", "Radiation Oncology", "English", 3, "Professional"],
  ["Doctoral", "105123", "Radiology", "English", 3, "Professional"],
  ["Doctoral", "105124", "Ultrasound Medicine", "English", 3, "Professional"],
  ["Doctoral", "105125", "Nuclear Medicine", "English", 3, "Professional"],
];

const routeKey = ([level, code, , language, duration, degreeType]: Route) => [level, code, language ?? "", duration, degreeType].join("|");
if (new Set(routes.map(routeKey)).size !== routes.length) throw new Error("Wave 55 route keys are not unique.");

const notRequired = new Set([
  "Master|083900|Chinese|3|Academic",
  "Master|120200|English|2|Academic",
  "Master|020200|English|2|Academic",
  "Master|050300|Chinese|2|Academic",
  "Master|010100|Chinese|3|Academic",
  "Master|030300|Chinese|3|Academic",
  "Master|140300|Chinese|3|Academic",
  "Master|045300|Chinese|3|Professional",
  "Doctoral|083900|Chinese|3|Academic",
  "Doctoral|120200|English|3|Academic",
  "Doctoral|020200|English|3|Academic",
]);
const offeringSpecific = new Set(["Master|050300|Chinese|3|Academic"]);

const slugPart = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const programs: CatalogSeedProgram[] = routes.map((route) => {
  const [degreeLevel, code, name, language, durationYears, degreeType] = route;
  const source = evidence.get(`xjtu-${degreeLevel === "Master" ? "master" : "doctoral"}-program-list-2027`)!;
  const index = evidence.get(`xjtu-${degreeLevel === "Master" ? "master" : "doctoral"}-program-index-2027`)!;
  const key = routeKey(route);
  const acceptance = notRequired.has(key)
    ? "The official catalog marks a supervisor acceptance letter as not required for this route."
    : offeringSpecific.has(key)
      ? "Supervisor acceptance-letter requirements differ by listed offering; consult the official catalog for the selected school or supervisor."
      : "The official catalog marks a supervisor acceptance letter as required for the listed offering(s).";
  const languageSlug = language ? language.toLowerCase() : "language-unspecified";
  const languageRequirement = language === "Chinese"
    ? { hskRequirement: "Current XJTU general eligibility: valid HSK Level 4 with 180 points or above; an approved alternative certificate may be accepted, and a prior Chinese-medium degree from a Chinese university may qualify for the published exemption." }
    : language === "English"
      ? { englishRequirement: "Current XJTU general eligibility: IELTS 6.0 or above or TOEFL 80 or above; another language-proficiency certificate may be accepted with XJTU approval. Program-specific requirements take precedence." }
      : {};
  return {
    slug: `xi-an-jiaotong-university-2027-${degreeLevel.toLowerCase()}-${code}-${languageSlug}-${String(durationYears).replace(".", "-")}y-${degreeType.toLowerCase()}`,
    schoolSlug: school.slug,
    citySlug: city.slug,
    nameEn: name,
    degreeLevel,
    ...(Number.isInteger(durationYears) ? { durationYears } : { durationMonths: Math.round(durationYears * 12) }),
    subjectArea: name,
    ...(language ? { teachingLanguage: language } : {}),
    ...languageRequirement,
    applicationUrl: index.finalUrl ?? index.url,
    applicationNote: `Official 2027 ${degreeType.toLowerCase()} ${degreeLevel.toLowerCase()} program, code ${code}. ${acceptance} Current general XJTU language requirements are applied by the listed teaching language; program-specific requirements take precedence. The 2027 program list does not publish an application window or tuition schedule.`,
    displayGroup: `xjtu-2027-${degreeLevel.toLowerCase()}-${slugPart(degreeType)}`,
    displayGroupLabel: `2027 ${degreeType} ${degreeLevel} programs`,
    status: "active",
    verificationStatus: "verified",
    lastVerifiedAt: source.fetchedAt,
    sourceUrl: source.finalUrl ?? source.url,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    sourceFieldLineage: {
      nameEn: "official workbook Programs column; obvious duplicated English spelling variants normalized by program code",
      degreeLevel: "official workbook title",
      ...(Number.isInteger(durationYears)
        ? { durationYears: "official workbook Basic Study Duration (Y) column" }
        : { durationMonths: "official workbook Basic Study Duration (Y) column; 2.5 years normalized to 30 months" }),
      subjectArea: "official workbook Programs column",
      ...(language ? { teachingLanguage: "official workbook Teaching Language column" } : {}),
      ...(language === "Chinese" ? { hskRequirement: "current official Eligibility and Application Documents page" } : {}),
      ...(language === "English" ? { englishRequirement: "current official Eligibility and Application Documents page" } : {}),
      applicationUrl: "registered official program-list index",
      applicationNote: "official workbook Program Code, Degree Type and supervisor acceptance-letter columns plus current official general eligibility page",
    },
  };
});

const generatedAt = [...evidence.values()].map((row) => row.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt,
  cities: [city],
  schools: [school],
  programs,
  programIntakes: [],
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 55 validation failed:\n${validation.errors.join("\n")}`);

const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: programs.length, new2027Intakes: 0, refreshedScholarships: 0, sourceSnapshots: evidence.size },
  evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
  unresolved: [
    "The official 2027 program lists do not publish a general application window, intake term or tuition schedule; these fields remain absent.",
    "Language thresholds come from XJTU's current general eligibility page rather than a dated 2027 guide. Program-specific requirements take precedence, and no threshold is assigned to the one doctoral row whose teaching language is not published.",
    "The doctoral Occupational and Environmental Health row has no legible English/Chinese marker in the Teaching Language cell; teachingLanguage remains absent.",
    "Program-level supervisor names are deliberately not migrated. Acceptance-letter requirements are summarized only at the route level and remain offering-specific where the same route has conflicting rows.",
  ],
  notes: [
    "Wave 55 adds 73 master's and 74 doctoral 2027 XJTU program routes from the official October 19, 2026 workbooks.",
    "Rows repeated for multiple supervisors or schools are collapsed by degree level, program code, teaching language, duration and degree type. Obvious duplicated English spelling variants are normalized without changing program codes.",
    "No applicant, account, passport, payment, contact-person, supervisor-contact or other personal data is included.",
  ],
};

const stem = resolve(root, "seeds/catalog.2027-wave-55");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({
  ok: true,
  wave: 55,
  candidateSha256,
  counts: { cities: 1, schools: 1, programs: programs.length, programIntakes: 0, scholarships: 0, sourceSnapshots: evidence.size },
  publicationAuthorized: false,
}, null, 2));
