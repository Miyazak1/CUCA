export type InsightCategory = {
  slug: "admissions-updates" | "program-watch" | "scholarship-watch";
  name: string;
  description: string;
};

export type InsightSource = {
  url: string;
  label: string;
  checkedAt: string;
};

export type InsightSection = {
  id: string;
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type InsightPost = {
  status: "draft" | "published";
  version: number;
  slug: string;
  title: string;
  description: string;
  category: InsightCategory["slug"];
  tags: string[];
  publishedAt: string;
  updatedAt: string;
  author: string;
  readingMinutes: number;
  featured: boolean;
  sections: InsightSection[];
  sources: InsightSource[];
  relatedGuides: Array<{ href: string; label: string }>;
};

export const insightCategories: InsightCategory[] = [
  {
    slug: "admissions-updates",
    name: "Admissions updates",
    description: "What current university notices mean for application planning, documents, and timing.",
  },
  {
    slug: "program-watch",
    name: "Program watch",
    description: "Changes and patterns in current English-taught and international degree listings.",
  },
  {
    slug: "scholarship-watch",
    name: "Scholarship watch",
    description: "Current scholarship announcements, coverage language, and application timing.",
  },
];

const posts: InsightPost[] = [
  {
    status: "published",
    version: 1,
    slug: "2026-admissions-notices-what-applicants-should-track",
    title: "2026 China admissions notices: what applicants should track now",
    description: "A current-cycle briefing on the details that change between university notices and why applicants should keep an evidence log.",
    category: "admissions-updates",
    tags: ["2026 intake", "application planning", "official notices"],
    publishedAt: "2026-10-09T08:00:00.000Z",
    updatedAt: "2026-10-09T08:00:00.000Z",
    author: "UCAC Editorial",
    readingMinutes: 5,
    featured: true,
    sections: [
      {
        id: "different-notices",
        heading: "The 2026 cycle is not one national checklist",
        paragraphs: [
          "University notices for the same intake can organize requirements in very different ways. One university may place language evidence, entrance examinations, documents, fees, and deadlines on a single page. Another may split the program catalog, scholarship notice, and application instructions across several official pages or attachments.",
          "That difference is operational, not cosmetic. An applicant should treat the exact university and program notice as the controlling source, record when it was checked, and avoid carrying a requirement from one institution into another application.",
        ],
      },
      {
        id: "tracking-list",
        heading: "Keep one dated record for every target route",
        paragraphs: [
          "A useful application record links each decision to an official page or attachment. It should be updated when the university revises the notice or publishes a more specific program document.",
        ],
        bullets: [
          "Program name, degree level, teaching language, and intake year",
          "Accepted language evidence and any stated exemption wording",
          "Required examinations or CSCA subjects where the university states them",
          "Application opening date, deadline, fee, and submission channel",
          "Document, translation, notarization, and health-form requirements",
          "Official URL, attachment name, and the date the source was checked",
        ],
      },
      {
        id: "conflicts",
        heading: "Do not resolve conflicting pages by guessing",
        paragraphs: [
          "If a general admissions page and a program attachment disagree, keep both references and ask the university which one applies to the chosen route. The newer page is not automatically more specific, and a translated summary may omit a condition found in the primary notice.",
          "UCAC treats unresolved conflicts as a reason to pause the factual field rather than silently select a convenient value. Applicants can use the same principle in their own records.",
        ],
      },
    ],
    sources: [
      {
        url: "https://iczu.zju.edu.cn/admissionsen/2024/1030/c68988a2981659/page.htm",
        label: "Zhejiang University 2026 international undergraduate admissions",
        checkedAt: "2026-10-09T07:14:00.625Z",
      },
      {
        url: "https://sie.uibe.edu.cn/en/Prgr/BacDegPro/OfEn/abc864a25c554202bf5c9acbf53d2729.htm",
        label: "UIBE 2026 international undergraduate program notice",
        checkedAt: "2026-10-09T07:14:05.838Z",
      },
    ],
    relatedGuides: [
      { href: "/guides/china-undergraduate-application-documents-checklist", label: "China undergraduate application documents checklist" },
    ],
  },
  {
    status: "published",
    version: 1,
    slug: "2026-english-taught-program-lists-why-details-matter",
    title: "2026 English-taught program lists: why the final details matter",
    description: "Teaching language is only the first filter. Current program lists also expose academic, language, examination, and route-specific conditions.",
    category: "program-watch",
    tags: ["English-taught programs", "2026 intake", "program catalog"],
    publishedAt: "2026-10-09T08:10:00.000Z",
    updatedAt: "2026-10-09T08:10:00.000Z",
    author: "UCAC Editorial",
    readingMinutes: 5,
    featured: false,
    sections: [
      {
        id: "headline-is-not-enough",
        heading: "English-taught is not a complete eligibility decision",
        paragraphs: [
          "A program being listed as English-taught does not by itself answer whether an applicant is eligible. Current university materials can add accepted English tests, minimum scores, prior-medium-of-instruction evidence, academic prerequisites, entrance examinations, or program-specific CSCA subjects.",
          "The practical unit of comparison is therefore the named program for the named intake, not a university-wide English label.",
        ],
      },
      {
        id: "compare-fields",
        heading: "Compare the same fields across every shortlist entry",
        paragraphs: [
          "A consistent shortlist prevents an attractive headline from hiding a missing requirement. Each row should contain enough evidence to explain why the route remains eligible.",
        ],
        bullets: [
          "Official program title and degree awarded",
          "Teaching language and accepted admission-language evidence",
          "Academic prerequisites and examination subjects",
          "Tuition and other compulsory fees stated for the intake",
          "Application deadline and official application channel",
          "Source date and a note for any unresolved wording",
        ],
      },
      {
        id: "catalog-changes",
        heading: "Program catalogs can change after an early shortlist",
        paragraphs: [
          "An early university overview is useful for discovery, but the final application decision should use the current program catalog or the specific program notice. Applicants should recheck the source before paying an application fee and again before submitting documents.",
          "This is why UCAC separates discovery from verification: search results help form a shortlist, while official program evidence supports the final decision.",
        ],
      },
    ],
    sources: [
      {
        url: "https://iczu.zju.edu.cn/_upload/article/files/e7/8c/1be7b2df433fb9427df707571d84/f8f1cb33-05a5-4fec-a602-3eac6caf8e14.pdf",
        label: "Zhejiang University 2026 English-taught undergraduate program catalog",
        checkedAt: "2026-10-09T07:14:01.818Z",
      },
      {
        url: "https://sie.uibe.edu.cn/en/Prgr/BacDegPro/OfEn/index.htm",
        label: "UIBE international undergraduate programs offered in English",
        checkedAt: "2026-10-09T07:14:06.509Z",
      },
    ],
    relatedGuides: [
      { href: "/guides/shortlist-chinese-universities-english-bachelors", label: "How to shortlist English-taught bachelor's degrees" },
      { href: "/guides/study-in-china-in-english-without-hsk", label: "Can you study in China in English without HSK?" },
    ],
  },
  {
    status: "published",
    version: 1,
    slug: "2026-scholarship-announcements-coverage-and-timing",
    title: "2026 scholarship announcements: compare coverage and timing separately",
    description: "Current scholarship notices show why award value, eligible route, application channel, and deadline need separate checks.",
    category: "scholarship-watch",
    tags: ["scholarships", "2026 intake", "funding"],
    publishedAt: "2026-10-09T08:20:00.000Z",
    updatedAt: "2026-10-09T08:20:00.000Z",
    author: "UCAC Editorial",
    readingMinutes: 6,
    featured: false,
    sections: [
      {
        id: "coverage",
        heading: "A scholarship name does not define its full value",
        paragraphs: [
          "Scholarship notices can describe coverage as full, partial, annual, one-time, or limited to specific cost categories. Applicants should record tuition, accommodation, stipend, insurance, duration, and renewal conditions separately instead of reducing the notice to a single label.",
          "Two awards with similar names may support different degree levels, programs, nationalities, or application channels. The official notice for the chosen intake is the evidence that matters.",
        ],
      },
      {
        id: "timing",
        heading: "Admission timing and scholarship timing may diverge",
        paragraphs: [
          "A university admission route can remain open after a scholarship deadline has passed. Some scholarship routes also require a separate government or university submission in addition to the degree application.",
          "Build the calendar from the earliest required step. Include nomination, pre-admission, document legalization, and any parallel application portal mentioned in the notice.",
        ],
      },
      {
        id: "comparison",
        heading: "Use a coverage matrix before estimating net cost",
        paragraphs: [
          "Only subtract benefits that the current notice states explicitly and that apply to the applicant's route. Keep unlisted travel, deposits, residence permits, medical examinations, books, and personal expenses outside the award until another official source confirms them.",
        ],
        bullets: [
          "Eligible degree, program, intake, and applicant group",
          "Tuition amount or waiver wording",
          "Accommodation form, cap, or exclusion",
          "Stipend amount and payment period",
          "Insurance and other stated benefits",
          "Deadline, application channel, duration, and renewal rule",
        ],
      },
    ],
    sources: [
      {
        url: "https://sie.uibe.edu.cn/en/Newsss/NotAnn/015d323bb31249e280505021cd4ca20c.htm",
        label: "UIBE 2026 Silk Road Program of Chinese Government Scholarship",
        checkedAt: "2026-10-09T07:14:07.420Z",
      },
      {
        url: "https://hwxy.nju.edu.cn/lxnd/zsxx/jxj/zgzfjxj/20231025/i252280.html",
        label: "Nanjing University 2026 Chinese Government Scholarship Type B high-level graduate program",
        checkedAt: "2026-10-09T07:14:03.137Z",
      },
      {
        url: "https://hwxy.nju.edu.cn/lxnd/zsxx/jxj/njszfjxj/index.html",
        label: "Nanjing University 2026 Nanjing Government Scholarship",
        checkedAt: "2026-10-09T07:14:04.045Z",
      },
    ],
    relatedGuides: [
      { href: "/guides/compare-scholarships-china-coverage-costs", label: "How to compare China scholarships by coverage and cost" },
    ],
  },
];

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertContent() {
  const categorySlugs = new Set(insightCategories.map((category) => category.slug));
  const postSlugs = new Set<string>();
  for (const post of posts) {
    if (!slugPattern.test(post.slug) || postSlugs.has(post.slug)) throw new Error("Invalid or duplicate insight slug.");
    if (!categorySlugs.has(post.category)) throw new Error("Insight category is not registered.");
    if (!Number.isSafeInteger(post.version) || post.version < 1) throw new Error("Insight versions must be positive integers.");
    if (post.status === "published" && (!post.sections.length || !post.sources.length)) throw new Error("Published insights require sections and official sources.");
    for (const source of post.sources) {
      const url = new URL(source.url);
      if (url.protocol !== "https:") throw new Error("Insight sources must use HTTPS.");
      if (new Date(source.checkedAt).toISOString() !== source.checkedAt) throw new Error("Insight source timestamps must be canonical UTC.");
    }
    postSlugs.add(post.slug);
  }
}

assertContent();

export function listInsights(): InsightPost[] {
  return posts.filter((post) => post.status === "published").sort((a, b) => Number(b.featured) - Number(a.featured) || b.publishedAt.localeCompare(a.publishedAt));
}

export function getInsight(slug: string): InsightPost | null {
  if (!slugPattern.test(slug)) return null;
  return posts.find((post) => post.slug === slug && post.status === "published") ?? null;
}

export function getInsightCategory(slug: string): InsightCategory | null {
  if (!slugPattern.test(slug)) return null;
  return insightCategories.find((category) => category.slug === slug) ?? null;
}

export function listInsightsByCategory(category: InsightCategory["slug"]): InsightPost[] {
  return listInsights().filter((post) => post.category === category);
}

export function categoryFor(post: InsightPost): InsightCategory {
  const category = insightCategories.find((candidate) => candidate.slug === post.category);
  if (!category) throw new Error("Insight category is not registered.");
  return category;
}
