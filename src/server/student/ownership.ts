import { evaluatePolicy, type PolicyDecision } from "../policy/policy.ts";
import type { RequestContext } from "../shared/request-context.ts";

export type StudentOwnedResource = {
  id: string;
  ownerUserId: string;
  dataClasses?: readonly ("student_pii" | "education_record" | "low_sensitive_preference" | "payment_business")[];
};

export function canReadStudentOwnedResource(context: RequestContext, resource: StudentOwnedResource): PolicyDecision {
  return evaluatePolicy(context, "student.read_own", {
    type: "student",
    ownerUserId: resource.ownerUserId,
    dataClasses: resource.dataClasses ?? ["student_pii"],
  });
}

export function canWriteStudentOwnedResource(context: RequestContext, resource: StudentOwnedResource): PolicyDecision {
  return evaluatePolicy(context, "student.write_own", {
    type: "student",
    ownerUserId: resource.ownerUserId,
    dataClasses: resource.dataClasses ?? ["student_pii"],
  });
}
