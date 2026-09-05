import { PostgresAuthSessionRepository } from "../../auth/postgres-repository.ts";
import { PostgresAuditWriter } from "../../audit/postgres-writer.ts";
import { createTransactionalSqlClient, getSharedPostgresPool, type TransactionalSqlClient } from "../../db/postgres-client.ts";
import { transactionalMethod } from "../../db/transactional-method.ts";
import { createStudentHttpHandlers } from "../http.ts";
import { PostgresStudentCoreRepository } from "../postgres-repository.ts";
import { StudentCoreService, type StudentCoreRepository } from "../service.ts";
import { PostgresApplicationCommands } from "../postgres-application-commands.ts";
import { serviceUnavailable } from "../../shared/errors.ts";

const emptyStudentRepository: StudentCoreRepository = {
  async getAssessmentHistory() { throw serviceUnavailable("Assessment repository is not configured."); },
  async addAssessmentRecord() { throw serviceUnavailable("Assessment repository is not configured."); },
  async updateAssessmentRecord() { throw serviceUnavailable("Assessment repository is not configured."); },
  async removeAssessmentRecord() { throw serviceUnavailable("Assessment repository is not configured."); },
  async getEducationHistory() { throw serviceUnavailable("Education repository is not configured."); },
  async addEducationRecord() { throw serviceUnavailable("Education repository is not configured."); },
  async updateEducationRecord() { throw serviceUnavailable("Education repository is not configured."); },
  async removeEducationRecord() { throw serviceUnavailable("Education repository is not configured."); },
  async getApplicantProfileByUserId() { throw serviceUnavailable("Applicant repository is not configured."); },
  async updateApplicantProfile() { throw serviceUnavailable("Applicant repository is not configured."); },
  async getProfileByUserId() {
    return null;
  },
  async upsertProfile() {
    throw new Error("Student repository is not configured.");
  },
  async listSavedItemsByUserId() {
    return [];
  },
  async saveItem() {
    throw new Error("Student repository is not configured.");
  },
  async removeSavedItem() {
    throw new Error("Student repository is not configured.");
  },
  async listApplicationSetsByUserId() {
    return [];
  },
  async getApplicationSetById() {
    return null;
  },
  async createApplicationSet() {
    throw new Error("Student repository is not configured.");
  },
  async addApplicationChoice() {
    throw new Error("Student repository is not configured.");
  },
  async removeApplicationChoice() {
    throw new Error("Student repository is not configured.");
  },
  async updateApplicationChoice() {
    throw new Error("Student repository is not configured.");
  },
  async reorderApplicationChoices() {
    throw new Error("Student repository is not configured.");
  },
};

const guestOnlyAuthRepository = {
  async findActiveSessionByTokenHash() {
    return null;
  },
};

export function createStudentRouteHandlers(repository: StudentCoreRepository = emptyStudentRepository) {
  return createStudentHttpHandlers(new StudentCoreService(repository), guestOnlyAuthRepository);
}

export function getStudentRouteHandlers() {
  try {
    const pool = getSharedPostgresPool();
    const client = createTransactionalSqlClient(pool);
    return createStudentHttpHandlers(createPostgresStudentService(client), new PostgresAuthSessionRepository(client));
  } catch {
    return createStudentRouteHandlers();
  }
}

export function createPostgresStudentService(client: TransactionalSqlClient) {
  const create = (tx: TransactionalSqlClient) => {
    const audit = new PostgresAuditWriter(tx);
    return new StudentCoreService(new PostgresStudentCoreRepository(tx), audit, new PostgresApplicationCommands(tx, audit));
  };
  const reads = create(client);
  return {
    getOwnAssessmentHistory: reads.getOwnAssessmentHistory.bind(reads),
    addOwnAssessmentRecord: transactionalMethod(client, create, "addOwnAssessmentRecord"),
    updateOwnAssessmentRecord: transactionalMethod(client, create, "updateOwnAssessmentRecord"),
    removeOwnAssessmentRecord: transactionalMethod(client, create, "removeOwnAssessmentRecord"),
    getOwnEducationHistory: reads.getOwnEducationHistory.bind(reads),
    addOwnEducationRecord: transactionalMethod(client, create, "addOwnEducationRecord"),
    updateOwnEducationRecord: transactionalMethod(client, create, "updateOwnEducationRecord"),
    removeOwnEducationRecord: transactionalMethod(client, create, "removeOwnEducationRecord"),
    getOwnApplicantProfile: reads.getOwnApplicantProfile.bind(reads),
    updateOwnApplicantProfile: transactionalMethod(client, create, "updateOwnApplicantProfile"),
    getOwnProfile: reads.getOwnProfile.bind(reads),
    listOwnSavedItems: reads.listOwnSavedItems.bind(reads),
    listOwnApplicationSets: reads.listOwnApplicationSets.bind(reads),
    getOwnApplicationSet: reads.getOwnApplicationSet.bind(reads),
    updateOwnProfile: transactionalMethod(client, create, "updateOwnProfile"),
    saveOwnItem: transactionalMethod(client, create, "saveOwnItem"),
    removeOwnSavedItem: transactionalMethod(client, create, "removeOwnSavedItem"),
    createOwnApplicationSet: transactionalMethod(client, create, "createOwnApplicationSet"),
    addOwnApplicationChoice: transactionalMethod(client, create, "addOwnApplicationChoice"),
    removeOwnApplicationChoice: transactionalMethod(client, create, "removeOwnApplicationChoice"),
    updateOwnApplicationChoice: transactionalMethod(client, create, "updateOwnApplicationChoice"),
    reorderOwnApplicationChoices: transactionalMethod(client, create, "reorderOwnApplicationChoices"),
  };
}
