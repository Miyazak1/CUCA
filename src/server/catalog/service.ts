import type { RequestContext } from "../shared/request-context.ts";
import { evaluatePolicy } from "../policy/policy.ts";
import { badRequest, forbidden } from "../shared/errors.ts";
import type {
  CatalogListOptions,
  PublicCityDetailDto,
  PublicCityDto,
  PublicProgramDetailDto,
  PublicProgramDto,
  PublicProgramIntakeDto,
  PublicScholarshipDetailDto,
  PublicScholarshipDto,
  PublicSchoolDetailDto,
  PublicSchoolDto,
} from "./dto.ts";
import { inputText, inputUuid } from "../shared/input.ts";
import type { PublicProgramRequirementsDto } from "./requirements.ts";

export type PublicCatalogRepository = {
  listPrograms(options: CatalogListOptions): Promise<PublicProgramDto[]>;
  getProgram(programId: string): Promise<PublicProgramDetailDto | null>;
  listProgramIntakes(programId: string, options: CatalogListOptions): Promise<PublicProgramIntakeDto[]>;
  getProgramRequirements(programId: string, intakeId: string): Promise<PublicProgramRequirementsDto | null>;
  listSchools(options: CatalogListOptions): Promise<PublicSchoolDto[]>;
  getSchool(schoolId: string): Promise<PublicSchoolDetailDto | null>;
  listScholarships(options: CatalogListOptions): Promise<PublicScholarshipDto[]>;
  getScholarship(scholarshipId: string): Promise<PublicScholarshipDetailDto | null>;
  listCities(options: CatalogListOptions): Promise<PublicCityDto[]>;
  getCity(citySlug: string): Promise<PublicCityDetailDto | null>;
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

export function normalizeListOptions(options: CatalogListOptions): Required<Omit<CatalogListOptions, "query">> & Pick<CatalogListOptions, "query"> {
  return {
    limit: Math.min(Math.max(options.limit ?? 20, 1), 100),
    offset: Math.max(options.offset ?? 0, 0),
    query: options.query?.trim() || undefined,
  };
}
