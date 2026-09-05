export function assessmentInput(expectedRevision = 0, extra = {}) {
  return { expectedRevision, assessmentCategory: "language", assessmentName: "Private language exam", assessmentVariant: "Scale edition",
    resultStatus: "reported", resultForm: "single_sitting", testDate: "2026-02-01", reportDate: "2026-02-03",
    components: [{ name: "Overall", value: "7.50", scale: "0-9", testDate: "2026-02-01" }], ...extra };
}
