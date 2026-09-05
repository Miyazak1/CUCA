export type CatalogSeedEntityStatus = "active" | "draft" | "archived";

export type CatalogSeedSource = {
  sourceUrl: string;
  sourceLabel: string;
  capturedAt?: string;
  sourceFieldLineage?: Record<string, unknown>;
};

export type CatalogSeedCity = CatalogSeedSource & {
  slug: string;
  nameEn: string;
  nameZh?: string;
  region?: string;
  province?: string;
  status?: CatalogSeedEntityStatus;
};

export type CatalogSeedSchool = CatalogSeedSource & {
  slug: string;
  nameEn: string;
  nameZh?: string;
  citySlug?: string;
  schoolType?: string;
  region?: string;
  status?: CatalogSeedEntityStatus;
};

export type CatalogSeedProgram = CatalogSeedSource & {
  slug: string;
  schoolSlug: string;
  nameEn: string;
  nameZh?: string;
  degreeLevel: string;
  teachingLanguage?: string;
  tuitionText?: string;
  status?: CatalogSeedEntityStatus;
};

export type CatalogSeedScholarship = CatalogSeedSource & {
  slug: string;
  title: string;
  schoolSlug?: string;
  programSlug?: string;
  providerName?: string;
  fundingLevel?: string;
  amountText?: string;
  status?: CatalogSeedEntityStatus;
};

export type CatalogSeedBundle = {
  version: 1;
  generatedAt: string;
  cities?: CatalogSeedCity[];
  schools?: CatalogSeedSchool[];
  programs?: CatalogSeedProgram[];
  scholarships?: CatalogSeedScholarship[];
};

export type CatalogSeedValidationResult = {
  ok: boolean;
  errors: string[];
  summary: {
    cities: number;
    schools: number;
    programs: number;
    scholarships: number;
  };
};

export type CatalogSeedImportEntityType = "city" | "school" | "program" | "scholarship";

export type CatalogSeedImportOperation = {
  order: number;
  entityType: CatalogSeedImportEntityType;
  slug: string;
  idempotencyKey: string;
  dependencyKeys: string[];
  sourceEvidence: CatalogSeedSource;
  status: CatalogSeedEntityStatus;
};

export type CatalogSeedImportPlan = CatalogSeedValidationResult & {
  operations: CatalogSeedImportOperation[];
};

export function validateCatalogSeedBundle(bundle: unknown): CatalogSeedValidationResult {
  const errors: string[] = [];
  const value = asRecord(bundle);

  if (!value) {
    return emptyResult(["Seed bundle must be a JSON object."]);
  }

  if (value.version !== 1) {
    errors.push("version must be 1.");
  }

  requireString(value, "generatedAt", "generatedAt", errors);

  const cities = readArray<CatalogSeedCity>(value, "cities", errors);
  const schools = readArray<CatalogSeedSchool>(value, "schools", errors);
  const programs = readArray<CatalogSeedProgram>(value, "programs", errors);
  const scholarships = readArray<CatalogSeedScholarship>(value, "scholarships", errors);

  validateEntities("cities", cities, ["slug", "nameEn", "sourceUrl", "sourceLabel"], errors);
  validateEntities("schools", schools, ["slug", "nameEn", "sourceUrl", "sourceLabel"], errors);
  validateEntities("programs", programs, ["slug", "schoolSlug", "nameEn", "degreeLevel", "sourceUrl", "sourceLabel"], errors);
  validateEntities("scholarships", scholarships, ["slug", "title", "sourceUrl", "sourceLabel"], errors);
  validateReferences({ cities, schools, programs, scholarships }, errors);

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      cities: cities.length,
      schools: schools.length,
      programs: programs.length,
      scholarships: scholarships.length,
    },
  };
}

export function createCatalogSeedImportPlan(bundle: unknown): CatalogSeedImportPlan {
  const validation = validateCatalogSeedBundle(bundle);

  if (!validation.ok) {
    return {
      ...validation,
      operations: [],
    };
  }

  const seedBundle = bundle as CatalogSeedBundle;
  const operations: CatalogSeedImportOperation[] = [];

  for (const city of seedBundle.cities ?? []) {
    operations.push(createOperation(operations.length + 1, "city", city.slug, [], city));
  }

  for (const school of seedBundle.schools ?? []) {
    operations.push(
      createOperation(operations.length + 1, "school", school.slug, school.citySlug ? [`city:${school.citySlug}`] : [], school),
    );
  }

  for (const program of seedBundle.programs ?? []) {
    operations.push(createOperation(operations.length + 1, "program", program.slug, [`school:${program.schoolSlug}`], program));
  }

  for (const scholarship of seedBundle.scholarships ?? []) {
    const dependencyKeys = [
      ...(scholarship.schoolSlug ? [`school:${scholarship.schoolSlug}`] : []),
      ...(scholarship.programSlug ? [`program:${scholarship.programSlug}`] : []),
    ];
    operations.push(createOperation(operations.length + 1, "scholarship", scholarship.slug, dependencyKeys, scholarship));
  }

  return {
    ...validation,
    operations,
  };
}

function validateEntities(entityName: string, entities: readonly Record<string, unknown>[], requiredFields: readonly string[], errors: string[]) {
  const seenSlugs = new Set<string>();

  entities.forEach((entity, index) => {
    for (const field of requiredFields) {
      requireString(entity, field, `${entityName}[${index}].${field}`, errors);
    }

    const slug = entity.slug;

    if (typeof slug === "string") {
      if (seenSlugs.has(slug)) {
        errors.push(`${entityName}[${index}].slug duplicates ${slug}.`);
      }

      seenSlugs.add(slug);
    }

    if ("status" in entity && entity.status !== undefined && !["active", "draft", "archived"].includes(String(entity.status))) {
      errors.push(`${entityName}[${index}].status must be active, draft, or archived.`);
    }
  });
}

function validateReferences(
  bundle: {
    cities: readonly CatalogSeedCity[];
    schools: readonly CatalogSeedSchool[];
    programs: readonly CatalogSeedProgram[];
    scholarships: readonly CatalogSeedScholarship[];
  },
  errors: string[],
) {
  const citySlugs = new Set(bundle.cities.map((city) => city.slug));
  const schoolSlugs = new Set(bundle.schools.map((school) => school.slug));
  const programSlugs = new Set(bundle.programs.map((program) => program.slug));

  bundle.schools.forEach((school, index) => {
    if (school.citySlug && !citySlugs.has(school.citySlug)) {
      errors.push(`schools[${index}].citySlug references unknown city ${school.citySlug}.`);
    }
  });

  bundle.programs.forEach((program, index) => {
    if (!schoolSlugs.has(program.schoolSlug)) {
      errors.push(`programs[${index}].schoolSlug references unknown school ${program.schoolSlug}.`);
    }
  });

  bundle.scholarships.forEach((scholarship, index) => {
    if (scholarship.schoolSlug && !schoolSlugs.has(scholarship.schoolSlug)) {
      errors.push(`scholarships[${index}].schoolSlug references unknown school ${scholarship.schoolSlug}.`);
    }

    if (scholarship.programSlug && !programSlugs.has(scholarship.programSlug)) {
      errors.push(`scholarships[${index}].programSlug references unknown program ${scholarship.programSlug}.`);
    }
  });
}

function readArray<T>(value: Record<string, unknown>, field: string, errors: string[]): T[] {
  if (value[field] === undefined) {
    return [];
  }

  if (!Array.isArray(value[field])) {
    errors.push(`${field} must be an array.`);
    return [];
  }

  return value[field] as T[];
}

function requireString(value: Record<string, unknown>, field: string, label: string, errors: string[]) {
  if (typeof value[field] !== "string" || !value[field]) {
    errors.push(`${label} is required.`);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function emptyResult(errors: string[]): CatalogSeedValidationResult {
  return {
    ok: false,
    errors,
    summary: {
      cities: 0,
      schools: 0,
      programs: 0,
      scholarships: 0,
    },
  };
}

function createOperation(
  order: number,
  entityType: CatalogSeedImportEntityType,
  slug: string,
  dependencyKeys: string[],
  source: CatalogSeedSource & { status?: CatalogSeedEntityStatus },
): CatalogSeedImportOperation {
  return {
    order,
    entityType,
    slug,
    idempotencyKey: `${entityType}:${slug}`,
    dependencyKeys,
    sourceEvidence: {
      sourceUrl: source.sourceUrl,
      sourceLabel: source.sourceLabel,
      capturedAt: source.capturedAt,
      sourceFieldLineage: source.sourceFieldLineage ?? {},
    },
    status: source.status ?? "draft",
  };
}
