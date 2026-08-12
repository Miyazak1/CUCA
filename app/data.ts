export type DegreeLevel = "undergraduate" | "master" | "phd" | "non_degree";
export type TeachingLanguage = "english" | "chinese" | "bilingual";
export type DeadlineStatus =
  | "open"
  | "closes_soon"
  | "urgent"
  | "closed"
  | "late_intake";
export type SourceStatus = "verified" | "stale" | "pending";
export type ReadinessLevel =
  | "strong_match"
  | "likely_eligible"
  | "needs_review"
  | "blocked";
export type ChoiceStatus =
  | "draft"
  | "documents_missing"
  | "ready_for_review"
  | "adviser_reviewing"
  | "returned";
export type DocumentStatus =
  | "missing"
  | "uploading"
  | "uploaded"
  | "under_review"
  | "accepted"
  | "rejected"
  | "expired"
  | "locked";
export type SectionStatus =
  | "not_started"
  | "in_progress"
  | "needs_attention"
  | "ready"
  | "submitted"
  | "returned"
  | "locked";

export type ApplicationSectionKey =
  | "personal"
  | "passport"
  | "education"
  | "language_tests"
  | "choices"
  | "documents"
  | "study_plan"
  | "recommendation"
  | "scholarship"
  | "review";

export type University = {
  id: string;
  name: string;
  nameZh?: string;
  cityId: string;
  province: string;
  type: "partner" | "verified" | "public_source";
  websiteUrl?: string;
  admissionsUrl?: string;
  sourceStatus: SourceStatus;
  lastVerifiedAt?: string;
};

export type City = {
  id: string;
  slug: string;
  name: string;
  province: string;
  monthlyCostRmb: number;
  costLevel: "low" | "medium" | "high";
  climateSummary: string;
  studentLifeSummary: string;
};

export type Program = {
  id: string;
  name: string;
  universityId: string;
  cityId: string;
  degreeLevel: DegreeLevel;
  subjectArea: string;
  teachingLanguage: TeachingLanguage;
  intake: string;
  intakeTerm: "spring" | "fall";
  intakeYear: number;
  durationYears: number;
  deadlineDate: string;
  deadlineStatus: DeadlineStatus;
  tuitionRmb: number;
  tuitionPeriod: "year" | "program";
  scholarshipAvailable: boolean;
  scholarshipIds: string[];
  hskRequirement?: string;
  englishRequirement?: string;
  admissionTestRequirement?: string;
  documentRequirementIds: string[];
  documentBurden: "light" | "medium" | "heavy";
  vacancyStatus: "open" | "limited" | "full" | "unknown";
  lateIntakeAvailable: boolean;
  sourceUrl?: string;
  sourceLabel?: string;
  sourceStatus: SourceStatus;
  lastVerifiedAt?: string;
  summary: string;
  fitTags: string[];
};

export type Scholarship = {
  id: string;
  name: string;
  type: "government" | "university" | "city" | "external";
  coverage: "full" | "partial" | "tuition_waiver" | "stipend" | "unknown";
  amountText: string;
  eligibleDegreeLevels: DegreeLevel[];
  deadlineDate?: string;
  deadlineStatus?: DeadlineStatus;
  programIds: string[];
  universityIds: string[];
  sourceUrl?: string;
  sourceStatus: SourceStatus;
  lastVerifiedAt?: string;
};

export type DocumentRequirement = {
  id: string;
  type: string;
  label: string;
  description: string;
  requiredForProgramIds: string[];
  reusable: boolean;
  translationRequired: boolean;
  expiryRelevant: boolean;
  sourceStatus: SourceStatus;
};

export type StudentDocument = {
  id: string;
  requirementId: string;
  status: DocumentStatus;
  fileName?: string;
  uploadedAt?: string;
  expiresAt?: string;
  reviewNote?: string;
  requiredByProgramIds: string[];
};

export type StudentProfile = {
  id: string;
  displayName: string;
  nationality: string;
  currentEducationLevel: "high_school" | "undergraduate" | "master" | "other";
  targetDegreeLevel: DegreeLevel;
  targetIntakeYear: number;
  preferredTeachingLanguage: TeachingLanguage;
  budgetMaxRmbPerYear?: number;
  preferredCityIds: string[];
  hasPassport: boolean;
  hasEnglishTest: boolean;
  hasHsk: boolean;
  profileCompleteness: number;
};

export type ApplicationBlocker = {
  id: string;
  type: "profile" | "document" | "deadline" | "section";
  label: string;
  actionLabel: string;
  targetRoute: string;
  severity: "hard" | "warning";
};

export type ApplicationChoice = {
  id: string;
  programId: string;
  status: ChoiceStatus;
  addedAt: string;
  blockers: ApplicationBlocker[];
};

export type ApplicationPacket = {
  id: string;
  studentProfileId: string;
  choiceIds: string[];
  status:
    | "draft"
    | "documents_missing"
    | "ready_for_review"
    | "adviser_reviewing"
    | "returned";
  sectionStatuses: Record<ApplicationSectionKey, SectionStatus>;
  adviserReviewRequested: boolean;
  updatedAt: string;
};

export type Message = {
  id: string;
  type: "system" | "adviser" | "deadline" | "document" | "offer" | "source";
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  targetRoute?: string;
};

export const cities: City[] = [
  {
    id: "hangzhou",
    slug: "hangzhou",
    name: "Hangzhou",
    province: "Zhejiang",
    monthlyCostRmb: 3600,
    costLevel: "medium",
    climateSummary: "Mild, humid, and green.",
    studentLifeSummary: "A strong tech and university city with calmer daily life.",
  },
  {
    id: "shanghai",
    slug: "shanghai",
    name: "Shanghai",
    province: "Shanghai",
    monthlyCostRmb: 5200,
    costLevel: "high",
    climateSummary: "Humid summers and cool winters.",
    studentLifeSummary: "International, fast moving, and rich in internships.",
  },
  {
    id: "beijing",
    slug: "beijing",
    name: "Beijing",
    province: "Beijing",
    monthlyCostRmb: 4800,
    costLevel: "high",
    climateSummary: "Cold winters, dry springs, warm summers.",
    studentLifeSummary: "Academic, political, and full of cultural landmarks.",
  },
  {
    id: "shenzhen",
    slug: "shenzhen",
    name: "Shenzhen",
    province: "Guangdong",
    monthlyCostRmb: 4600,
    costLevel: "high",
    climateSummary: "Warm and subtropical.",
    studentLifeSummary: "Young, tech-focused, and startup-heavy.",
  },
];

export const universities: University[] = [
  {
    id: "zju",
    name: "Zhejiang University",
    nameZh: "浙江大学",
    cityId: "hangzhou",
    province: "Zhejiang",
    type: "verified",
    websiteUrl: "https://www.zju.edu.cn/",
    admissionsUrl: "https://iczu.zju.edu.cn/",
    sourceStatus: "verified",
    lastVerifiedAt: "2026-08-01",
  },
  {
    id: "fudan",
    name: "Fudan University",
    nameZh: "复旦大学",
    cityId: "shanghai",
    province: "Shanghai",
    type: "verified",
    sourceStatus: "verified",
    lastVerifiedAt: "2026-07-28",
  },
  {
    id: "tongji",
    name: "Tongji University",
    nameZh: "同济大学",
    cityId: "shanghai",
    province: "Shanghai",
    type: "public_source",
    sourceStatus: "stale",
    lastVerifiedAt: "2026-04-18",
  },
  {
    id: "blcu",
    name: "Beijing Language and Culture University",
    nameZh: "北京语言大学",
    cityId: "beijing",
    province: "Beijing",
    type: "partner",
    sourceStatus: "verified",
    lastVerifiedAt: "2026-08-03",
  },
  {
    id: "hitsz",
    name: "Harbin Institute of Technology Shenzhen",
    nameZh: "哈尔滨工业大学深圳",
    cityId: "shenzhen",
    province: "Guangdong",
    type: "verified",
    sourceStatus: "pending",
  },
  {
    id: "uibe",
    name: "University of International Business and Economics",
    nameZh: "对外经济贸易大学",
    cityId: "beijing",
    province: "Beijing",
    type: "public_source",
    sourceStatus: "verified",
    lastVerifiedAt: "2026-08-05",
  },
];

export const scholarships: Scholarship[] = [
  {
    id: "csc-a",
    name: "Chinese Government Scholarship Type A",
    type: "government",
    coverage: "full",
    amountText: "Full tuition, accommodation, insurance, and monthly stipend",
    eligibleDegreeLevels: ["master", "phd"],
    deadlineDate: "2026-12-31",
    deadlineStatus: "open",
    programIds: ["zju-cs-msc", "tongji-civil-msc", "tsinghua-env-phd"],
    universityIds: ["zju", "tongji"],
    sourceStatus: "verified",
    lastVerifiedAt: "2026-08-01",
  },
  {
    id: "zju-excellence",
    name: "ZJU International Excellence Scholarship",
    type: "university",
    coverage: "partial",
    amountText: "Tuition support up to RMB 30,000",
    eligibleDegreeLevels: ["master"],
    deadlineDate: "2026-10-15",
    deadlineStatus: "closes_soon",
    programIds: ["zju-cs-msc"],
    universityIds: ["zju"],
    sourceStatus: "verified",
    lastVerifiedAt: "2026-08-01",
  },
  {
    id: "shanghai-city",
    name: "Shanghai Government Scholarship",
    type: "city",
    coverage: "partial",
    amountText: "Partial tuition and living support",
    eligibleDegreeLevels: ["undergraduate", "master"],
    deadlineDate: "2026-09-30",
    deadlineStatus: "urgent",
    programIds: ["fudan-econ-ba", "tongji-civil-msc"],
    universityIds: ["fudan", "tongji"],
    sourceStatus: "stale",
    lastVerifiedAt: "2026-05-10",
  },
  {
    id: "uibe-late",
    name: "UIBE Late Intake Merit Award",
    type: "university",
    coverage: "tuition_waiver",
    amountText: "Merit tuition waiver for late intake applicants",
    eligibleDegreeLevels: ["master"],
    deadlineDate: "2026-11-10",
    deadlineStatus: "late_intake",
    programIds: ["uibe-trade-msc"],
    universityIds: ["uibe"],
    sourceStatus: "verified",
    lastVerifiedAt: "2026-08-05",
  },
  {
    id: "stem-talent",
    name: "International STEM Talent Grant",
    type: "external",
    coverage: "stipend",
    amountText: "Monthly stipend for selected STEM applicants",
    eligibleDegreeLevels: ["master", "phd"],
    deadlineDate: "2026-10-05",
    deadlineStatus: "open",
    programIds: ["hitsz-ai-msc", "zju-cs-msc"],
    universityIds: ["hitsz", "zju"],
    sourceStatus: "pending",
  },
];

export const documentRequirements: DocumentRequirement[] = [
  {
    id: "passport",
    type: "passport",
    label: "Passport photo page",
    description: "A clear scan of the passport page with your photo and identity details.",
    requiredForProgramIds: [],
    reusable: true,
    translationRequired: false,
    expiryRelevant: true,
    sourceStatus: "verified",
  },
  {
    id: "transcript",
    type: "transcript",
    label: "High school transcript",
    description: "Your latest official transcript.",
    requiredForProgramIds: [],
    reusable: true,
    translationRequired: false,
    expiryRelevant: false,
    sourceStatus: "verified",
  },
  {
    id: "translation",
    type: "translation",
    label: "Transcript translation",
    description: "Certified English or Chinese translation when original transcript is in another language.",
    requiredForProgramIds: ["zju-cs-msc", "fudan-econ-ba", "tongji-civil-msc"],
    reusable: true,
    translationRequired: true,
    expiryRelevant: false,
    sourceStatus: "verified",
  },
  {
    id: "graduation",
    type: "certificate",
    label: "Graduation certificate",
    description: "Graduation certificate or expected graduation letter.",
    requiredForProgramIds: [],
    reusable: true,
    translationRequired: true,
    expiryRelevant: false,
    sourceStatus: "verified",
  },
  {
    id: "ielts",
    type: "language",
    label: "IELTS or TOEFL certificate",
    description: "English proof for English-taught programs.",
    requiredForProgramIds: [
      "zju-cs-msc",
      "tongji-civil-msc",
      "hitsz-ai-msc",
      "uibe-trade-msc",
    ],
    reusable: true,
    translationRequired: false,
    expiryRelevant: true,
    sourceStatus: "verified",
  },
  {
    id: "hsk",
    type: "language",
    label: "HSK certificate",
    description: "Chinese language proof for Chinese-taught programs.",
    requiredForProgramIds: ["fudan-econ-ba", "blcu-language"],
    reusable: true,
    translationRequired: false,
    expiryRelevant: true,
    sourceStatus: "verified",
  },
  {
    id: "study-plan",
    type: "statement",
    label: "Study plan",
    description: "A short statement explaining your academic goals in China.",
    requiredForProgramIds: ["zju-cs-msc", "uibe-trade-msc", "hitsz-ai-msc"],
    reusable: false,
    translationRequired: false,
    expiryRelevant: false,
    sourceStatus: "pending",
  },
  {
    id: "recommendation",
    type: "reference",
    label: "Recommendation letter",
    description: "Teacher or counsellor recommendation.",
    requiredForProgramIds: ["zju-cs-msc", "tongji-civil-msc", "hitsz-ai-msc"],
    reusable: true,
    translationRequired: false,
    expiryRelevant: false,
    sourceStatus: "verified",
  },
];

export const programs: Program[] = [
  {
    id: "zju-cs-msc",
    name: "Computer Science MSc",
    universityId: "zju",
    cityId: "hangzhou",
    degreeLevel: "master",
    subjectArea: "Computer Science",
    teachingLanguage: "english",
    intake: "Fall 2026",
    intakeTerm: "fall",
    intakeYear: 2026,
    durationYears: 2,
    deadlineDate: "2026-10-15",
    deadlineStatus: "closes_soon",
    tuitionRmb: 42000,
    tuitionPeriod: "year",
    scholarshipAvailable: true,
    scholarshipIds: ["csc-a", "zju-excellence", "stem-talent"],
    englishRequirement: "IELTS 6.5 or TOEFL 90",
    admissionTestRequirement: "University review; CSCA may apply for selected undergraduate routes",
    documentRequirementIds: [
      "passport",
      "transcript",
      "translation",
      "graduation",
      "ielts",
      "study-plan",
      "recommendation",
    ],
    documentBurden: "heavy",
    vacancyStatus: "limited",
    lateIntakeAvailable: false,
    sourceUrl: "https://iczu.zju.edu.cn/",
    sourceLabel: "ZJU International College admissions",
    sourceStatus: "verified",
    lastVerifiedAt: "2026-08-01",
    summary: "A research-focused English-taught computing program in Hangzhou.",
    fitTags: ["English taught", "Scholarship options", "Closes soon"],
  },
  {
    id: "fudan-econ-ba",
    name: "Economics BA",
    universityId: "fudan",
    cityId: "shanghai",
    degreeLevel: "undergraduate",
    subjectArea: "Economics",
    teachingLanguage: "chinese",
    intake: "Fall 2026",
    intakeTerm: "fall",
    intakeYear: 2026,
    durationYears: 4,
    deadlineDate: "2026-09-12",
    deadlineStatus: "urgent",
    tuitionRmb: 26000,
    tuitionPeriod: "year",
    scholarshipAvailable: true,
    scholarshipIds: ["shanghai-city"],
    hskRequirement: "HSK 5 or above",
    admissionTestRequirement: "CSCA/admission test may be requested",
    documentRequirementIds: [
      "passport",
      "transcript",
      "translation",
      "graduation",
      "hsk",
    ],
    documentBurden: "medium",
    vacancyStatus: "limited",
    lateIntakeAvailable: false,
    sourceStatus: "verified",
    lastVerifiedAt: "2026-07-28",
    summary: "Chinese-taught undergraduate economics route in Shanghai.",
    fitTags: ["Chinese taught", "HSK needed", "Urgent deadline"],
  },
  {
    id: "tongji-civil-msc",
    name: "Civil Engineering MSc",
    universityId: "tongji",
    cityId: "shanghai",
    degreeLevel: "master",
    subjectArea: "Engineering",
    teachingLanguage: "english",
    intake: "Fall 2026",
    intakeTerm: "fall",
    intakeYear: 2026,
    durationYears: 2,
    deadlineDate: "2026-11-20",
    deadlineStatus: "open",
    tuitionRmb: 39000,
    tuitionPeriod: "year",
    scholarshipAvailable: true,
    scholarshipIds: ["csc-a", "shanghai-city"],
    englishRequirement: "IELTS 6.0 or TOEFL 80",
    documentRequirementIds: [
      "passport",
      "transcript",
      "translation",
      "graduation",
      "ielts",
      "recommendation",
    ],
    documentBurden: "medium",
    vacancyStatus: "open",
    lateIntakeAvailable: false,
    sourceStatus: "stale",
    lastVerifiedAt: "2026-04-18",
    summary: "Engineering program with strong city and industry access.",
    fitTags: ["Engineering", "Source needs recheck", "Scholarship"],
  },
  {
    id: "blcu-language",
    name: "Chinese Language Non-degree",
    universityId: "blcu",
    cityId: "beijing",
    degreeLevel: "non_degree",
    subjectArea: "Chinese Language",
    teachingLanguage: "chinese",
    intake: "Spring 2027",
    intakeTerm: "spring",
    intakeYear: 2027,
    durationYears: 1,
    deadlineDate: "2026-12-20",
    deadlineStatus: "open",
    tuitionRmb: 22000,
    tuitionPeriod: "program",
    scholarshipAvailable: false,
    scholarshipIds: [],
    hskRequirement: "Placement test after arrival",
    documentRequirementIds: ["passport", "transcript", "graduation"],
    documentBurden: "light",
    vacancyStatus: "open",
    lateIntakeAvailable: true,
    sourceStatus: "verified",
    lastVerifiedAt: "2026-08-03",
    summary: "Language-focused route for students preparing for Chinese-taught degrees.",
    fitTags: ["Light documents", "Spring intake", "Language path"],
  },
  {
    id: "hitsz-ai-msc",
    name: "Artificial Intelligence MSc",
    universityId: "hitsz",
    cityId: "shenzhen",
    degreeLevel: "master",
    subjectArea: "Artificial Intelligence",
    teachingLanguage: "english",
    intake: "Fall 2026",
    intakeTerm: "fall",
    intakeYear: 2026,
    durationYears: 2,
    deadlineDate: "2026-10-05",
    deadlineStatus: "closes_soon",
    tuitionRmb: 45000,
    tuitionPeriod: "year",
    scholarshipAvailable: true,
    scholarshipIds: ["stem-talent"],
    englishRequirement: "IELTS 6.5 or equivalent",
    documentRequirementIds: [
      "passport",
      "transcript",
      "graduation",
      "ielts",
      "study-plan",
      "recommendation",
    ],
    documentBurden: "heavy",
    vacancyStatus: "unknown",
    lateIntakeAvailable: false,
    sourceStatus: "pending",
    summary: "AI program in Shenzhen with strong technology ecosystem fit.",
    fitTags: ["Tech city", "English taught", "Source pending"],
  },
  {
    id: "uibe-trade-msc",
    name: "International Trade MSc",
    universityId: "uibe",
    cityId: "beijing",
    degreeLevel: "master",
    subjectArea: "Business",
    teachingLanguage: "english",
    intake: "Late Fall 2026",
    intakeTerm: "fall",
    intakeYear: 2026,
    durationYears: 2,
    deadlineDate: "2026-11-10",
    deadlineStatus: "late_intake",
    tuitionRmb: 36000,
    tuitionPeriod: "year",
    scholarshipAvailable: true,
    scholarshipIds: ["uibe-late"],
    englishRequirement: "English certificate accepted after initial review",
    documentRequirementIds: ["passport", "transcript", "graduation", "ielts", "study-plan"],
    documentBurden: "medium",
    vacancyStatus: "open",
    lateIntakeAvailable: true,
    sourceStatus: "verified",
    lastVerifiedAt: "2026-08-05",
    summary: "Late-intake business option for students still preparing documents.",
    fitTags: ["Late intake", "Business", "Flexible English proof"],
  },
];

export const profile: StudentProfile = {
  id: "student-preview",
  displayName: "Maya",
  nationality: "Indonesia",
  currentEducationLevel: "high_school",
  targetDegreeLevel: "master",
  targetIntakeYear: 2026,
  preferredTeachingLanguage: "english",
  budgetMaxRmbPerYear: 46000,
  preferredCityIds: ["hangzhou", "shanghai", "shenzhen"],
  hasPassport: true,
  hasEnglishTest: false,
  hasHsk: false,
  profileCompleteness: 68,
};

export const initialDocuments: StudentDocument[] = documentRequirements.map(
  (requirement, index) => ({
    id: `doc-${requirement.id}`,
    requirementId: requirement.id,
    status:
      requirement.id === "passport"
        ? "accepted"
        : requirement.id === "transcript"
          ? "uploaded"
          : requirement.id === "translation"
            ? "missing"
            : "missing",
    fileName:
      requirement.id === "passport"
        ? "maya-passport.pdf"
        : requirement.id === "transcript"
          ? "grade-12-transcript.pdf"
          : undefined,
    uploadedAt: index < 2 ? "2026-08-10" : undefined,
    requiredByProgramIds: requirement.requiredForProgramIds,
  }),
);

export const initialPacket: ApplicationPacket = {
  id: "packet-2026",
  studentProfileId: profile.id,
  choiceIds: [],
  status: "draft",
  adviserReviewRequested: false,
  updatedAt: "2026-08-12T00:00:00.000Z",
  sectionStatuses: {
    personal: "ready",
    passport: "ready",
    education: "in_progress",
    language_tests: "needs_attention",
    choices: "not_started",
    documents: "needs_attention",
    study_plan: "not_started",
    recommendation: "not_started",
    scholarship: "in_progress",
    review: "locked",
  },
};

export const initialMessages: Message[] = [
  {
    id: "msg-deadline",
    type: "deadline",
    title: "ZJU closes soon",
    body: "Computer Science MSc closes on 15 Oct. Prepare IELTS and transcript translation first.",
    createdAt: "2026-08-12T08:00:00.000Z",
    read: false,
    targetRoute: "/programs/zju-cs-msc",
  },
  {
    id: "msg-source",
    type: "source",
    title: "Tongji source needs recheck",
    body: "The Civil Engineering MSc page is useful, but the source is older than our launch freshness target.",
    createdAt: "2026-08-11T11:30:00.000Z",
    read: false,
  },
  {
    id: "msg-adviser",
    type: "adviser",
    title: "Adviser access is limited",
    body: "Preview adviser can read your shortlist and document names, but cannot submit anything.",
    createdAt: "2026-08-10T09:00:00.000Z",
    read: true,
  },
];

export function universityFor(program: Program) {
  return universities.find((item) => item.id === program.universityId)!;
}

export function cityFor(program: Program) {
  return cities.find((item) => item.id === program.cityId)!;
}

export function requirementFor(id: string) {
  return documentRequirements.find((item) => item.id === id)!;
}

export function scholarshipsFor(program: Program) {
  return scholarships.filter((item) => program.scholarshipIds.includes(item.id));
}

export function formatMoney(value: number) {
  return `RMB ${value.toLocaleString("en-US")}`;
}

export function labelDegree(value: DegreeLevel) {
  const labels: Record<DegreeLevel, string> = {
    undergraduate: "Undergraduate",
    master: "Master",
    phd: "PhD",
    non_degree: "Non-degree",
  };
  return labels[value];
}

export function labelLanguage(value: TeachingLanguage) {
  const labels: Record<TeachingLanguage, string> = {
    english: "English-taught",
    chinese: "Chinese-taught",
    bilingual: "Bilingual",
  };
  return labels[value];
}

