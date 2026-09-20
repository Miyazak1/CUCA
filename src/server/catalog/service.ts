import type { RequestContext } from "../shared/request-context.ts";
import { evaluatePolicy } from "../policy/policy.ts";
import { badRequest, forbidden } from "../shared/errors.ts";
import type {
  CatalogListOptions,
  PublicCityDetailDto,
  PublicCityDto,
  PublicGuideDto,
  PublicProgramDetailDto,
  PublicProgramDto,
  PublicProgramIntakeDto,
  PublicProgramPageDto,
  PublicScholarshipDetailDto,
  PublicScholarshipDto,
  PublicSchoolDetailDto,
  PublicSchoolDto,
} from "./dto.ts";
import { inputText, inputUuid } from "../shared/input.ts";
import type { PublicProgramRequirementsDto } from "./requirements.ts";

export type PublicCatalogRepository = {
  listPrograms(options: CatalogListOptions): Promise<PublicProgramDto[]>;
  countPrograms?(options: CatalogListOptions): Promise<number>;
  getProgram(programId: string): Promise<PublicProgramDetailDto | null>;
  listProgramIntakes(programId: string, options: CatalogListOptions): Promise<PublicProgramIntakeDto[]>;
  getProgramRequirements(programId: string, intakeId: string): Promise<PublicProgramRequirementsDto | null>;
  listSchools(options: CatalogListOptions): Promise<PublicSchoolDto[]>;
  getSchool(schoolId: string): Promise<PublicSchoolDetailDto | null>;
  listScholarships(options: CatalogListOptions): Promise<PublicScholarshipDto[]>;
  getScholarship(scholarshipId: string): Promise<PublicScholarshipDetailDto | null>;
  listCities(options: CatalogListOptions): Promise<PublicCityDto[]>;
  getCity(citySlug: string): Promise<PublicCityDetailDto | null>;
  listGuides(options: CatalogListOptions): Promise<PublicGuideDto[]>;
  getGuide(guideSlug: string): Promise<PublicGuideDto | null>;
};

export class CatalogService {
  private readonly repository: PublicCatalogRepository;

  constructor(repository: PublicCatalogRepository) {
    this.repository = repository;
  }

  async listPrograms(context: RequestContext, options: CatalogListOptions = {}) {
    authorizePublicCatalogRead(context);
    return this.repository.listPrograms(normalizeListOptions(options));
  }

  async listProgramsPage(context: RequestContext, options: CatalogListOptions = {}): Promise<PublicProgramPageDto> {
    authorizePublicCatalogRead(context);
    const normalized = normalizeProgramListOptions(options);
    const [items, total] = await Promise.all([
      this.repository.listPrograms(normalized),
      this.repository.countPrograms?.(normalized),
    ]);
    return {
      items,
      total: total ?? items.length,
      limit: normalized.limit,
      offset: normalized.offset,
    };
  }

  async getProgram(context: RequestContext, programId: string) {
    authorizePublicCatalogRead(context);
    return this.repository.getProgram(inputUuid(programId, "programId"));
  }

  async listProgramIntakes(context: RequestContext, programId: string, options: CatalogListOptions = {}) {
    authorizePublicCatalogRead(context);
    return this.repository.listProgramIntakes(inputUuid(programId, "programId"), normalizeListOptions(options));
  }

  async listSchools(context: RequestContext, options: CatalogListOptions = {}) {
    authorizePublicCatalogRead(context);
    return this.repository.listSchools(normalizeListOptions(options));
  }

  async getProgramRequirements(context: RequestContext, programId: string, intakeId: string) {
    authorizePublicCatalogRead(context);
    return this.repository.getProgramRequirements(inputUuid(programId, "programId"), inputUuid(intakeId, "intakeId"));
  }

  async getSchool(context: RequestContext, schoolId: string) {
    authorizePublicCatalogRead(context);
    return this.repository.getSchool(inputUuid(schoolId, "schoolId"));
  }

  async listScholarships(context: RequestContext, options: CatalogListOptions = {}) {
    authorizePublicCatalogRead(context);
    return this.repository.listScholarships(normalizeListOptions(options));
  }

  async getScholarship(context: RequestContext, scholarshipId: string) {
    authorizePublicCatalogRead(context);
    return this.repository.getScholarship(inputUuid(scholarshipId, "scholarshipId"));
  }

  async listCities(context: RequestContext, options: CatalogListOptions = {}) {
    authorizePublicCatalogRead(context);
    return this.repository.listCities(normalizeListOptions(options));
  }

  async getCity(context: RequestContext, citySlug: string) {
    authorizePublicCatalogRead(context);
    const slug = inputText(citySlug, "citySlug", 120).toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw badRequest("citySlug must use lowercase URL-safe segments.");
    }
    return this.repository.getCity(slug);
  }

  async listGuides(context: RequestContext, options: CatalogListOptions = {}) {
    authorizePublicCatalogRead(context);
    return this.repository.listGuides(normalizeListOptions(options));
  }

  async getGuide(context: RequestContext, guideSlug: string) {
    authorizePublicCatalogRead(context);
    const slug = inputText(guideSlug, "guideSlug", 120).toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw badRequest("guideSlug must use lowercase URL-safe segments.");
    }
    return this.repository.getGuide(slug);
  }
}

export function authorizePublicCatalogRead(context: RequestContext): void {
  const decision = evaluatePolicy(context, "catalog.read_public", {
    type: "catalog",
    dataClasses: ["public_catalog"],
  });

  if (!decision.allowed) {
    throw forbidden(decision.reason);
  }
}

export function normalizeListOptions(options: CatalogListOptions): Pick<CatalogListOptions, "query"> & { limit: number; offset: number } {
  return {
    limit: Math.min(Math.max(options.limit ?? 20, 1), 100),
    offset: Math.max(options.offset ?? 0, 0),
    query: options.query?.trim() || undefined,
  };
}

export function normalizeProgramListOptions(options: CatalogListOptions): CatalogListOptions & { limit: number; offset: number } {
  const base = normalizeListOptions(options);
  const text = (value: string | undefined, maxLength = 120) => value?.trim().slice(0, maxLength) || undefined;
  return {
    ...base,
    degree: text(options.degree),
    subject: text(options.subject),
    language: text(options.language),
    city: text(options.city),
    school: text(options.school),
    intake: text(options.intake),
    deadline: text(options.deadline),
    tuition: text(options.tuition),
    scholarship: options.scholarship === true || undefined,
    applicationReady: options.applicationReady === true || undefined,
    upcomingDeadline: options.upcomingDeadline === true || undefined,
    languageRequirement: text(options.languageRequirement),
    sort: text(options.sort, 40),
  };
}
