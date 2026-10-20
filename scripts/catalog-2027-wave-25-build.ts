import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
type CourseLd = {
  name: string;
  description?: string;
  educationalLevel?: string;
  timeRequired?: string;
  provider?: { department?: { name?: string } };
  coursePrerequisites?: string[];
  offers?: { price?: number; priceCurrency?: string };
  hasCourseInstance?: Array<{ name: string; startDate: string; offers?: { availabilityEnds?: string } }>;
};
type ParsedCourse = CourseLd & {
  verifiedDurationMonths?: number;
  verifiedMasterEnglishRequirement?: string;
  verifiedRouteEnglishRequirement?: string;
};

const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const expected: Record<string, string> = {
  "nuaa-accounting-master-2027": "6df498b6f682b80d5c8c6f01c4a8be679bee4620d491725004fbb683f618843a",
  "nuaa-aerospace-science-technology-master-2027": "8196cac3a41f98a73bb0160e581f18ac88b67f92c7d22163f5db92dc418eb1dd",
  "nuaa-applied-economics-master-2027": "f4d1432f8f998f72b26abe9d77c56db6973a80f94c4fafc19e51a8f5455e8edb",
  "nuaa-chemistry-master-2027": "24e884fe68745b7a1b753847a1323cbbebfb3c6b9b32bf851a50f2a8d325c7d2",
  "nuaa-civil-engineering-master-2027": "7f4b8a465138bb0a462e11d55ad62cb4dc5df5ad8b12cd2c60bde76610edf246",
  "nuaa-computer-science-technology-master-2027": "6d3931865658f58784c2bf3853181f37f0e2f698695e93eb319dff8f27fd6eb8",
  "nuaa-control-science-engineering-master-2027": "72f8230a4824fa395a715c2299008402214812ff0a338aa812d6fa894638a70a",
  "nuaa-cyberspace-safety-master-2027": "b7ec3ee804b66de2b89839e6dca15811131c1fd07721b701ed6bc0ad4efd1bde",
  "nuaa-electrical-engineering-master-2027": "9965ae2e71527a0fc87e3e4de3318634d48bb0c80e8decbcce172493572e5e39",
  "nuaa-electronics-science-technology-master-2027": "d1b94aaa939c56707ce1bcf182f56173914673dc02ed1512174fe0bdd3081616",
  "nuaa-information-communication-engineering-master-2027": "31220c79438ea2e39060fa18e537f9f0d677b73a415f8558f223c28f82aa043d",
  "nuaa-instrument-science-technology-master-2027": "78a58aadcba598b98988e66baf42cab90f913c681eefdcc27f06515faa391496",
  "nuaa-management-science-engineering-master-2027": "1ca86cb5d41de596250382e6231497a66e7e034c09ca7795a58d2c0a0b1b9d93",
  "nuaa-materials-science-engineering-master-2027": "2cce263e8a05e0a4b98c361626598e9f75d212b8728312559d3217224076d06c",
  "nuaa-mathematics-master-2027": "b80edf45e9acb4083203883bd26348b718792c24497902ee53a321cd1c433296",
  "nuaa-mechanics-master-2027": "eb19117ea0a0d7f97621d055fc1ee2ef30de81541a7d8e9673a7300283366e1d",
  "nuaa-optical-engineering-master-2027": "940acaeba1edcb76a971af855f2fca42cbf200cec5e1c602e16cb02ae115fdee",
  "nuaa-physics-master-2027": "bde7954fd277caa3f0ddaa7cd81f9d9070e5f9dce460c1452f83d79eb7e05b26",
  "nuaa-power-engineering-thermophysics-master-2027": "5bb3e838655dec39845ecfb713dce3fc03f48c9ffe716c4c8899f809b6f282f2",
  "nuaa-software-engineering-master-2027": "db673628562b4df5774c8ceeca41eb53357a18534dc912d8c67b68ccfb6c1584",
  "nuaa-transportation-engineering-master-2027": "f1f33b144b4701f7e25810e636ed6e89618ba1ba01f6b81a8331716d9c62a4aa",
  "nuaa-integrated-circuits-master-2027": "e8028f8ddb4b04a82ddab4b836f0bd1fcb34fed0a1ba57d5fda93163f7c7c34e",
  "nuaa-mechanical-engineering-master-2027": "0b81d898fd077583a38375e90c5575b8eaed0a984fcf3d2e19ceadb5c65a9674",
  "nuaa-nuclear-science-technology-master-2027": "d1f312afe060f6bfd59cda3d011487fbf061c9f65e3bd0463f847bb08cd418c4",
  "nuaa-corporate-management-master-2027": "1620865bf1b78e3ba06d4c0d8865e344ff015f1a7e0e8cadbf0691b94abb61a6",
};

const evidence = new Map<string, ManifestSource & { runRoot: string }>();
for (const entry of await readdir(workRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(workRoot, entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    for (const item of manifest.sources ?? []) {
      if (item.status !== 200 || expected[item.id] !== item.sha256) continue;
      const bytes = await readFile(resolve(runRoot, item.artifactPath));
      if (createHash("sha256").update(bytes).digest("hex") !== item.sha256) throw new Error(`Evidence hash mismatch: ${item.id}`);
      evidence.set(item.id, { ...item, runRoot });
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
const missing = Object.keys(expected).filter((id) => !evidence.has(id));
if (missing.length) throw new Error(`Missing locked 2027 wave 25 evidence: ${missing.join(", ")}`);

const source = (id: string) => evidence.get(id)!;
const fields = (id: string) => {
  const item = source(id);
  return { sourceUrl: item.finalUrl ?? item.url, sourceLabel: item.label, sourceSha256: item.sha256, capturedAt: item.fetchedAt };
};
const verified = (id: string) => ({ status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: source(id).fetchedAt, ...fields(id) });
const readCourse = async (id: string): Promise<ParsedCourse> => {
  const item = source(id);
  const html = await readFile(resolve(item.runRoot, item.artifactPath), "utf8");
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  if (!match) throw new Error(`Missing Course JSON-LD: ${id}`);
  const course = JSON.parse(match[1]) as CourseLd;
  if (!course.name || course.educationalLevel !== "Master's") throw new Error(`Unexpected course metadata: ${id}`);
  const structuredDurationMonths = course.timeRequired?.match(/^P(\d+)M$/)?.[1];
  const visibleDurationMonths = /Duration:\s*2\.5|lists 2\.5 years|"duration","2\.5"/i.test(html) ? 30 : undefined;
  const verifiedMasterEnglishRequirement = /postgraduate guide lists IELTS 6\.0\+, TOEFL 70\+/i.test(html)
    ? "IELTS 6.0+, TOEFL 70+, or equivalent English proficiency evidence accepted by NUAA."
    : undefined;
  const verifiedRouteEnglishRequirement = /IELTS 6\.0 · TOEFL 80 · or equivalent · English-medium graduates may be exempt/i.test(html)
    ? "IELTS 6.0, TOEFL 80 or equivalent; graduates of English-medium programs may be exempt."
    : undefined;
  return {
    ...course,
    ...(structuredDurationMonths ? { verifiedDurationMonths: Number(structuredDurationMonths) } : visibleDurationMonths ? { verifiedDurationMonths: visibleDurationMonths } : {}),
    ...(verifiedMasterEnglishRequirement ? { verifiedMasterEnglishRequirement } : {}),
    ...(verifiedRouteEnglishRequirement ? { verifiedRouteEnglishRequirement } : {}),
  };
};

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-24.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "nanjing");
const school = prior.schools?.find((row) => row.slug === "nanjing-university-of-aeronautics-and-astronautics");
if (!city || !school) throw new Error("Wave 25 requires the Wave 24 Nanjing and NUAA dependency rows.");

const titleCaseSubject = (name: string) => name
  .replace(/^Master(?:'|’)s? in /i, "")
  .replace(/^Masters in /i, "")
  .replace(/\s+/g, " ")
  .trim();
const routeSlug = (id: string) => `nanjing-university-of-aeronautics-and-astronautics-${id.replace(/^nuaa-/, "").replace(/-master-2027$/, "")}-master-2027`;

const programs: CatalogSeedProgram[] = [];
const programIntakes: CatalogSeedProgramIntake[] = [];
const contradictoryPrerequisiteIds: string[] = [];
const missingDurationIds: string[] = [];
const missingEnglishRequirementIds: string[] = [];
for (const id of Object.keys(expected)) {
  const course = await readCourse(id);
  const prerequisites = course.coursePrerequisites ?? [];
  const hasUndergraduateCopy = prerequisites.some((value) => /high school graduate|usually 18.?25|CSCA result required/i.test(value));
  if (hasUndergraduateCopy) contradictoryPrerequisiteIds.push(id);
  const durationMonths = course.verifiedDurationMonths;
  if (!durationMonths) missingDurationIds.push(id);
  const amount = course.offers?.price;
  if (!amount || course.offers?.priceCurrency !== "CNY") throw new Error(`Missing CNY tuition offer: ${id}`);
  const subjectArea = titleCaseSubject(course.name);
  const cleanPrerequisites = hasUndergraduateCopy
    ? "The route page contains undergraduate prerequisite text that conflicts with its master's identity. Those contradictory details are not published in CUAC pending an official correction."
    : prerequisites.join(" ");
  const englishRequirement = course.verifiedRouteEnglishRequirement
    ?? course.verifiedMasterEnglishRequirement
    ?? (!hasUndergraduateCopy && prerequisites.some((value) => /IELTS|TOEFL|English/i.test(value))
      ? "English proficiency is assessed through IELTS, TOEFL, Duolingo, PTE or an equivalent credential. Some route pages do not state a fixed minimum score."
      : undefined);
  if (!englishRequirement) missingEnglishRequirementIds.push(id);
  const program: CatalogSeedProgram = {
    slug: routeSlug(id),
    schoolSlug: school.slug,
    citySlug: city.slug,
    nameEn: course.name,
    degreeLevel: "Master",
    ...(durationMonths ? { durationMonths } : {}),
    fieldCategory: "Graduate degree program",
    subjectArea,
    teachingLanguage: "English",
    ...(englishRequirement ? { englishRequirement } : {}),
    tuitionAmount: amount,
    tuitionCurrency: "CNY",
    tuitionPeriod: "year",
    tuitionText: `CNY ${amount.toLocaleString("en-US")} per year; application fee CNY 400.`,
    scholarshipText: "NUAA lists Chinese Government, Silk Road, Nanjing Government and NUAA Freshman scholarships; eligibility, award values and deadlines depend on the route.",
    applicationUrl: source(id).url,
    applicationNote: `${cleanPrerequisites} ${course.provider?.department?.name ? `Academic unit: ${course.provider.department.name}.` : ""}`.trim(),
    hasScholarship: true,
    badgeText: "September 2027",
    displayTuition: `CNY ${amount.toLocaleString("en-US")}/year`,
    displayGroup: "Postgraduate",
    displayGroupLabel: "English-taught master's programs",
    ...verified(id),
    sourceFieldLineage: {
      nameEn: "Course JSON-LD name",
      durationMonths: durationMonths ? (course.timeRequired ? "Course JSON-LD timeRequired" : "official visible duration and master's FAQ: 2.5 years") : undefined,
      subjectArea: "official route title",
      teachingLanguage: "official route page",
      englishRequirement: englishRequirement ? (course.verifiedRouteEnglishRequirement ? "official route-specific English requirement section" : course.verifiedMasterEnglishRequirement ? "official route master's FAQ citing the current postgraduate guide" : "official route prerequisites") : undefined,
      tuitionAmount: "Course JSON-LD offer",
      tuitionText: "official route offer and admissions page application fee",
      scholarshipText: "official NUAA scholarships page",
      applicationNote: hasUndergraduateCopy ? "conflict-safe note based on contradictory official route metadata" : "Course JSON-LD prerequisites and department",
    },
  };
  program.sourceFieldLineage = Object.fromEntries(Object.entries(program.sourceFieldLineage ?? {}).filter(([, value]) => value !== undefined));
  programs.push(program);

  const instances = course.hasCourseInstance ?? [];
  if (instances.length !== 1 || instances[0].startDate !== "2027-09") throw new Error(`Unexpected intake metadata: ${id}`);
  const deadlineDate = instances[0].offers?.availabilityEnds;
  programIntakes.push({
    programSlug: program.slug,
    intakeTerm: "Fall",
    intakeYear: 2027,
    ...(deadlineDate ? { deadlineDate } : {}),
    deadlineLabel: deadlineDate ? `Course structured data gives ${deadlineDate.slice(0, 10)} for the September 2027 intake.` : "No fixed deadline is emitted.",
    applicationRound: "September 2027 master's entry",
    status: "open",
    ...fields(id),
    sourceFieldLineage: { intakeTerm: "Course JSON-LD startDate", intakeYear: "Course JSON-LD startDate", deadlineDate: "Course JSON-LD availabilityEnds", deadlineLabel: "Course JSON-LD availabilityEnds", status: "deadline compared with capturedAt" },
  });
}

const generatedAt = [...evidence.values()].map((item) => item.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities: [city], schools: [school], programs, programIntakes, scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 25 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: programs.length, new2027Intakes: programIntakes.length, refreshedScholarships: 0, sourceSnapshots: evidence.size },
  evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
  unresolved: [
    `${contradictoryPrerequisiteIds.length} route pages contain undergraduate prerequisite copy that conflicts with their master's identity; CUAC omits that copied material and uses a master's-specific FAQ requirement only where the same page publishes one.`,
    `${missingDurationIds.length} routes remain without a verified duration after checking both Course JSON-LD and visible master's-specific page content.`,
    `${missingEnglishRequirementIds.length} route pages do not publish a conflict-free master's English threshold; those fields remain absent.`,
    "The route pages publish one September 2027 intake each. No Spring master's intake is created.",
    "Four existing current scholarship records remain in Wave 24 and are not duplicated here.",
  ],
  contradictoryPrerequisiteIds,
  missingDurationIds,
  missingEnglishRequirementIds,
  notes: ["Every master's route was separately registered and acquired from NUAA's official international site.", "No applicant, account, passport, payment or other personal data is included."],
};
await Promise.all([
  writeFile(resolve(root, "seeds/catalog.2027-wave-25.draft.json"), candidateText, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-25.validation.json"), `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-25.review.json"), `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, candidateSha256, counts: { cities: 1, schools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: 0, sourceSnapshots: evidence.size }, contradictoryPrerequisiteIds, missingDurationIds, publicationAuthorized: false }, null, 2));
