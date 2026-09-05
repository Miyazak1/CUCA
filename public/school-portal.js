const dataClient = window.CuacDataClient;
const APPLICATION_DEMO_STATE_KEY = dataClient?.storageKeys?.applicationDemoState || "cuacApplicationDemoState";
const SCHOOL_PORTAL_DEMO_STATE_KEY = dataClient?.storageKeys?.schoolPortalDemoState || "cuacSchoolPortalDemoState";
const NOTIFICATION_EVENTS_KEY = dataClient?.storageKeys?.notificationEvents || "cuacNotificationEventsDemoState";
const SCHOOL_ACCOUNT_NAME = dataClient?.config?.defaultSchoolTenant || "Zhejiang University";

let currentSchool = SCHOOL_ACCOUNT_NAME;
let currentApplication = "maya";
let quickFilter = "all";
let selectedRecords = new Set();
let analyticsRenderTimer;

const filters = {
  query: "",
  status: "all",
  program: "all",
  intake: "all",
  sort: "priority",
};

const applications = dataClient?.getSampleSchoolApplications?.(SCHOOL_ACCOUNT_NAME) || {
  maya: {
    school: "Zhejiang University",
    name: "Maya Chen",
    status: "New",
    source: "Prepared",
    programName: "Computer Science",
    degree: "MSc",
    intake: "Fall 2026",
    languageRoute: "English-taught",
    city: "Hangzhou",
    country: "Malaysia",
    email: "maya@example.com",
    phone: "+60 12 000 0000",
    stage: "Final-year undergraduate",
    funding: "Scholarship possible",
    language: "IELTS / waiver noted",
    deadline: "Scholarship window closing",
    fit: "Strong route fit",
    owner: "International Office",
    priority: "High",
    receivedAt: "2026-08-14T09:10:00",
    due: "Due: today",
    nextAction: "Contact student and request transcript, passport scan, language proof, and program-specific checklist.",
    note: "Interested in a realistic English-taught CS route in Hangzhou. Transcript translation may need follow-up.",
    timeline: ["CUAC received student route choice", "Routed to Zhejiang University tenant scope", "First contact not started"],
  },
  amir: {
    school: "Zhejiang University",
    name: "Amir Khan",
    status: "Needs review",
    source: "Prepared",
    programName: "Biomedical Engineering",
    degree: "MSc",
    intake: "Fall 2026",
    languageRoute: "English-taught",
    city: "Hangzhou",
    country: "Pakistan",
    email: "amir@example.com",
    phone: "+92 300 000 0000",
    stage: "Bachelor graduate",
    funding: "CSC route requested",
    language: "IELTS ready",
    deadline: "Lab fit needs confirmation",
    fit: "Review supervisor availability",
    owner: "Faculty Coordinator",
    priority: "High",
    receivedAt: "2026-08-13T15:40:00",
    due: "Due: tomorrow",
    nextAction: "Assign faculty review, confirm lab availability, then contact student for official material list.",
    note: "Strong engineering interest. The school should confirm lab availability and scholarship fit.",
    timeline: ["Prepared record created", "Scholarship intent noted", "Faculty fit pending"],
  },
  lina: {
    school: "Zhejiang University",
    name: "Lina Santos",
    status: "Contacted",
    source: "Prepared",
    programName: "Computer Science",
    degree: "BSc",
    intake: "Fall 2026",
    languageRoute: "English-taught",
    city: "Hangzhou",
    country: "Brazil",
    email: "lina@example.com",
    phone: "+55 11 0000 0000",
    stage: "High school graduate",
    funding: "Self-funded",
    language: "English-taught route",
    deadline: "Normal intake timing",
    fit: "Contact-ready",
    owner: "Admissions Desk",
    priority: "Normal",
    receivedAt: "2026-08-12T10:25:00",
    due: "Due: this week",
    nextAction: "Wait for transcript and passport scan through the school process.",
    note: "School contacted student and is waiting for transcript and passport scan through its own process.",
    timeline: ["Prepared record created", "School contacted student", "Waiting for transcript"],
  },
  noah: {
    school: "Zhejiang University",
    name: "Noah Mensah",
    status: "Waiting for documents",
    source: "Prepared",
    programName: "International Business",
    degree: "BSc",
    intake: "Spring 2027",
    languageRoute: "English-taught",
    city: "Hangzhou",
    country: "Ghana",
    email: "noah@example.com",
    phone: "+233 24 000 0000",
    stage: "High school final year",
    funding: "Self-funded",
    language: "English interview suggested",
    deadline: "Low deadline risk",
    fit: "Needs document check",
    owner: "Admissions Desk",
    priority: "Normal",
    receivedAt: "2026-08-10T08:20:00",
    due: "Due: next week",
    nextAction: "Follow up once the student sends high school transcript and passport scan.",
    note: "Student is comparing spring options and needs a clear document checklist before official school application.",
    timeline: ["Prepared record created", "Contact queued", "Document request sent"],
  },
};

const priorityRank = { High: 0, Normal: 1, Low: 2 };
const chartColors = ["#00756f", "#246da8", "#a76600", "#a33a32", "#5b6670"];
const pipelineOrder = ["New", "Needs review", "Contact queued", "Contacted", "Waiting for documents"];
const schoolFollowupRank = { viewed: 1, contacted: 2, "waiting-documents": 3 };
const schoolNameZh = {
  "Zhejiang University": "浙江大学",
};
const programZh = {
  "Computer Science MSc": "计算机科学硕士",
  "Computer Science": "计算机科学",
  "Biomedical Engineering MSc": "生物医学工程硕士",
  "Biomedical Engineering": "生物医学工程",
  "International Business BSc": "国际商务本科",
  "International Business": "国际商务",
  "Software Engineering MSc": "软件工程硕士",
  "Economics BA": "经济学本科",
  Engineering: "工程",
};
const statusZh = {
  New: "新记录",
  "Needs review": "需审核",
  "Contact queued": "待联系",
  Contacted: "已联系",
  "Waiting for documents": "等待材料",
  "Documents received by school": "学校已收材料",
};
const priorityZh = { High: "高", Normal: "普通", Low: "低" };
const sourceZh = {
  Prepared: "预置记录",
  "Live CUAC submission": "CUAC 实时提交",
  "CUAC submission": "CUAC 提交",
};
const countryZh = { Malaysia: "马来西亚", Pakistan: "巴基斯坦", Brazil: "巴西", Ghana: "加纳" };
const fieldZh = {
  transcriptFile: "成绩单",
  passportScan: "护照扫描件",
  languageCertificateFile: "语言证明",
  languageProof: "语言证明",
  passport: "护照",
  transcript: "成绩单",
  studyPlan: "学习计划",
  recommendationLetter: "推荐信",
  diplomaCertificate: "毕业证书",
};
const analyticsTargets = [
  "[data-analytics-status]",
  "[data-analytics-programs]",
  "[data-analytics-funding]",
  "[data-analytics-source]",
  "[data-analytics-countries]",
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function schoolLabel(value = SCHOOL_ACCOUNT_NAME) {
  return schoolNameZh[value] || value;
}

function statusLabel(value = "") {
  return statusZh[value] || value;
}

function priorityLabel(value = "") {
  return priorityZh[value] || value;
}

function sourceLabel(value = "") {
  return sourceZh[value] || (isIncomingSource(value) ? "CUAC 实时提交" : "预置记录");
}

function countryLabel(value = "") {
  return countryZh[value] || value || "未提供";
}

function programLabel(value = "") {
  let text = String(value || "");
  Object.entries(programZh)
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([en, zh]) => {
      text = text.replaceAll(en, zh);
    });
  return commonZh(text);
}

function dueLabel(value = "") {
  return String(value || "")
    .replace(/^Due:\s*today$/i, "截止：今天")
    .replace(/^Due:\s*tomorrow$/i, "截止：明天")
    .replace(/^Due:\s*this week$/i, "截止：本周")
    .replace(/^Due:\s*next week$/i, "截止：下周")
    .replace(/^Due:\s*/i, "截止：");
}

function listText(value, fallback = "") {
  if (Array.isArray(value)) return value.filter(Boolean).join(" + ") || fallback;
  return value || fallback;
}

function commonZh(value = "") {
  return String(value || "")
    .replaceAll("Interested in a realistic English-taught CS route in Hangzhou. Transcript translation may need follow-up.", "学生关注杭州英文授课计算机方向，成绩单翻译可能需要后续确认。")
    .replaceAll("Strong engineering interest. The school should confirm lab availability and scholarship fit.", "学生工程方向意向较强，学校需确认实验室名额和奖学金匹配。")
    .replaceAll("School contacted student and is waiting for transcript and passport scan through its own process.", "学校已联系学生，正在等待学生按学校流程提交成绩单和护照扫描件。")
    .replaceAll("Student is comparing spring options and needs a clear document checklist before official school application.", "学生正在比较春季入学选项，需要学校在正式申请前提供清晰材料清单。")
    .replaceAll("CUAC sent non-document application information for school follow-up.", "CUAC 已发送非材料申请信息，供学校后续联系学生。")
    .replaceAll("Biomedical Engineering MSc", "生物医学工程硕士")
    .replaceAll("Computer Science MSc", "计算机科学硕士")
    .replaceAll("International Business BSc", "国际商务本科")
    .replaceAll("Software Engineering MSc", "软件工程硕士")
    .replaceAll("Economics BA", "经济学本科")
    .replaceAll("Biomedical Engineering", "生物医学工程")
    .replaceAll("Computer Science", "计算机科学")
    .replaceAll("International Business", "国际商务")
    .replaceAll("Engineering", "工程")
    .replaceAll("English-taught", "英文授课")
    .replaceAll("Fall 2026", "2026 秋季")
    .replaceAll("Spring 2027", "2027 春季")
    .replaceAll("Master", "硕士")
    .replaceAll("Bachelor", "本科")
    .replaceAll("BSc", "本科")
    .replaceAll("MSc", "硕士")
    .replaceAll("Final-year undergraduate", "本科最后一年")
    .replaceAll("Bachelor graduate", "本科毕业")
    .replaceAll("High school graduate", "高中毕业")
    .replaceAll("High school final year", "高中最后一年")
    .replaceAll("Scholarship possible", "可能申请奖学金")
    .replaceAll("CSC route requested", "希望申请 CSC 路线")
    .replaceAll("Self-funded", "自费")
    .replaceAll("IELTS / waiver noted", "IELTS / 豁免待确认")
    .replaceAll("IELTS ready", "IELTS 已准备")
    .replaceAll("English-taught route", "英文授课路线")
    .replaceAll("English interview suggested", "建议英语面试")
    .replaceAll("Scholarship window closing", "奖学金窗口即将关闭")
    .replaceAll("Lab fit needs confirmation", "实验室匹配需确认")
    .replaceAll("Normal intake timing", "常规入学时间")
    .replaceAll("Low deadline risk", "截止风险较低")
    .replaceAll("Strong route fit", "路线匹配较强")
    .replaceAll("Review supervisor availability", "需确认导师名额")
    .replaceAll("Contact-ready", "可联系")
    .replaceAll("Needs document check", "需要材料检查")
    .replaceAll("International Office", "国际办公室")
    .replaceAll("Faculty Coordinator", "学院协调老师")
    .replaceAll("Admissions Desk", "招生办公室")
    .replaceAll("Contact student and request transcript, passport scan, language proof, and program-specific checklist.", "联系学生，并要求其提交成绩单、护照扫描件、语言证明和项目专属清单。")
    .replaceAll("Assign faculty review, confirm lab availability, then contact student for official material list.", "分配学院复核，确认实验室名额后联系学生索取正式材料清单。")
    .replaceAll("Wait for transcript and passport scan through the school process.", "等待学生按学校流程提交成绩单和护照扫描件。")
    .replaceAll("Follow up once the student sends high school transcript and passport scan.", "学生发送高中成绩单和护照扫描件后继续跟进。")
    .replaceAll("Wait for the school to contact the student directly.", "等待学校直接联系学生。")
    .replaceAll("Contact student and request the school document checklist directly.", "直接联系学生，并发送学校材料清单。")
    .replaceAll("School contacted student directly", "学校已直接联系学生")
    .replaceAll("School to confirm", "学校确认")
    .replaceAll("Selected by student", "学生已选择")
    .replaceAll("Not required", "不需要")
    .replaceAll("Not provided", "未提供")
    .replaceAll("Selected program", "已选项目")
    .replaceAll("Route", "路线")
    .replaceAll("Deadline pending", "截止日期待确认")
    .replaceAll("Tuition pending", "学费待确认")
    .replaceAll("CUAC received student route choice", "CUAC 已收到学生路线选择")
    .replaceAll("Routed to Zhejiang University tenant scope", "已发送到浙江大学租户范围")
    .replaceAll("First contact not started", "尚未开始首次联系")
    .replaceAll("Prepared record created", "预置记录已创建")
    .replaceAll("Scholarship intent noted", "已记录奖学金意向")
    .replaceAll("Faculty fit pending", "学院匹配待确认")
    .replaceAll("School contacted student", "学校已联系学生")
    .replaceAll("Waiting for transcript", "等待成绩单")
    .replaceAll("Contact queued", "已加入联系队列")
    .replaceAll("Document request sent", "材料请求已发送")
    .replaceAll("CUAC application record submitted", "CUAC 申请记录已提交")
    .replaceAll("Routed to school tenant scope", "已发送到学校租户范围");
}

function readApplicationDemoState() {
  if (dataClient?.readApplicationDemoState) return dataClient.readApplicationDemoState();
  try {
    return JSON.parse(localStorage.getItem(APPLICATION_DEMO_STATE_KEY) || "null");
  } catch {
    return null;
  }
}

function readSchoolPortalDemoState() {
  if (dataClient?.readSchoolPortalDemoState) return dataClient.readSchoolPortalDemoState();
  try {
    return JSON.parse(localStorage.getItem(SCHOOL_PORTAL_DEMO_STATE_KEY) || "null");
  } catch {
    return null;
  }
}

function getTenantSubmittedRecords() {
  if (dataClient?.getTenantSubmittedRecords) return dataClient.getTenantSubmittedRecords(SCHOOL_ACCOUNT_NAME);
  const state = readApplicationDemoState();
  if (!state?.submittedToSchools || !Array.isArray(state.submittedRecords)) return [];
  return state.submittedRecords.filter((record) => record?.school === SCHOOL_ACCOUNT_NAME);
}

function normalizeSubmittedRecord(record, index) {
  if (dataClient?.normalizeSchoolRecord) return dataClient.normalizeSchoolRecord(record, index, SCHOOL_ACCOUNT_NAME);
  return {
    school: SCHOOL_ACCOUNT_NAME,
    name: record.name || "CUAC student",
    status: record.status || "New",
    source: "Live CUAC submission",
    programName: record.programName || "Selected program",
    degree: record.degree || "Route",
    intake: record.intake || "Fall 2026",
    languageRoute: record.languageRoute || "English-taught",
    city: record.city || "Hangzhou",
    country: record.country || "Not provided",
    countryCode: record.countryCode || record.informationSources?.fromStudentProfile?.countryCode || "",
    email: record.email || "student@example.com",
    phone: record.phone || "Not provided",
    stage: record.stage || "Not provided",
    grade: record.grade || record.informationSources?.fromStudentProfile?.grade || record.stage || "Not provided",
    gradeCode: record.gradeCode || record.informationSources?.fromStudentProfile?.gradeCode || "",
    nationality: record.nationality || record.informationSources?.fromStudentProfile?.nationality || record.passportNationality || record.country || "Not provided",
    nationalityCode: record.nationalityCode || record.informationSources?.fromStudentProfile?.nationalityCode || "",
    passportNationality: record.passportNationality || record.informationSources?.fromStudentProfile?.passportNationality || record.country || "Not provided",
    currentSchool: record.currentSchool || record.informationSources?.fromStudentProfile?.currentSchool || "Not provided",
    currentOrganizationId: record.currentOrganizationId || record.informationSources?.fromStudentProfile?.currentOrganizationId || "",
    studentProfileUpdatedAt: record.studentProfileUpdatedAt || record.informationSources?.fromStudentProfile?.updatedAt || "",
    intendedLevel: record.intendedLevel || record.informationSources?.fromStudentProfile?.intendedLevel || record.degreeLevel || record.degree || "Not provided",
    funding: record.funding || "Not provided",
    language: record.language || "Not provided",
    guardianStatus: record.guardianStatus || record.informationSources?.fromStudentProfile?.guardianStatus || "Not provided",
    academicSummary: record.academicSummary || record.informationSources?.fromStudentProfile?.academicSummary || "Not provided",
    deadline: record.deadline || "School to confirm",
    fit: record.fit || "Selected by student",
    studentChoiceNote: record.studentChoiceNote || record.informationSources?.selectedByStudent?.studentChoiceNote || "",
    owner: record.owner || "International Office",
    priority: record.priority || "Normal",
    receivedAt: record.receivedAt || new Date().toISOString(),
    due: record.due || "Due: today",
    nextAction: record.nextAction || "Contact student and request the school document checklist directly.",
    note: record.note || "CUAC sent non-document application information for school follow-up.",
    timeline: Array.isArray(record.timeline) && record.timeline.length ? record.timeline : ["CUAC application record submitted", "Routed to school tenant scope", "First contact not started"],
    id: `live-${index}`,
  };
}

function hydrateSubmittedRecords() {
  const tenantRecords = getTenantSubmittedRecords();
  tenantRecords.forEach((record, index) => {
    const liveRecord = normalizeSubmittedRecord(record, index);
    applications[liveRecord.id] = liveRecord;
  });
  if (tenantRecords.length) currentApplication = "live-0";
}

function markLiveRecordsViewed() {
  Object.values(applications)
    .filter((record) => record.source === "Live CUAC submission")
    .forEach((record) => {
      const wrote = persistSchoolFollowup(record, "viewed", "School viewed your CUAC record");
      if (wrote) addSchoolContactNotification(record, "viewed");
    });
}

function persistSchoolFollowup(record, statusKey, statusLabel) {
  const state = readSchoolPortalDemoState() || {};
  const contactedSchools = new Set(state.contactedSchools || []);
  const school = record?.school || SCHOOL_ACCOUNT_NAME;
  const currentFollowups = state.schoolFollowups || {};
  const existing = currentFollowups[school];
  const existingRank = schoolFollowupRank[existing?.statusKey] || 0;
  const nextRank = schoolFollowupRank[statusKey] || 0;
  if (existingRank > nextRank || existing?.statusKey === statusKey) return false;
  const updatedAt = new Date().toISOString();
  if (["contacted", "waiting-documents"].includes(statusKey)) contactedSchools.add(school);
  const schoolFollowups = {
    ...currentFollowups,
    [school]: {
      ...existing,
      school,
      programName: record?.programName || "Selected program",
      degree: record?.degree || "Route",
      statusKey,
      statusLabel,
      nextAction: record?.nextAction || "Wait for the school to contact the student directly.",
      updatedAt,
    },
  };
  try {
    localStorage.setItem(
      SCHOOL_PORTAL_DEMO_STATE_KEY,
      JSON.stringify({
        ...state,
        contactedSchools: [...contactedSchools],
        schoolFollowups,
        lastContactedSchool: school,
        lastSchoolFollowup: schoolFollowups[school],
        updatedAt,
      }),
    );
    return true;
  } catch {
    // Demo storage can be unavailable in private or restricted preview contexts.
    return false;
  }
}

function addSchoolContactNotification(record, statusKey = "contacted") {
  const waiting = statusKey === "waiting-documents";
  const viewed = statusKey === "viewed";
  const school = record.school || SCHOOL_ACCOUNT_NAME;
  const program = record.programName || "selected program";
  const degree = record.degree || "route";
  const zhProgram = programLabel(program);
  const zhDegree = commonZh(degree);
  const event = {
    id: `school-${viewed ? "viewed" : waiting ? "waiting-documents" : "contacted"}-${String(school).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    type: "document",
    severity: viewed ? "info" : "action",
    group: "Today",
    title: viewed ? `${school} viewed your CUAC record` : waiting ? `${school} is waiting for documents` : `${school} contacted the student`,
    body: waiting
      ? `${school} moved ${program} ${degree} to waiting for documents. The student should continue through the school's own document request.`
      : viewed
        ? `${school} opened the school-only CUAC record for ${program} ${degree}. The school can contact the student directly for next steps.`
      : `${school} marked first contact complete for ${program} ${degree}. Official documents should now move through the school process, not CUAC upload.`,
    entity: `${school} · ${program}`,
    time: "Just now",
    action: "Open application",
    href: "application.html",
    prompt: waiting
      ? `Explain what to prepare now that ${school} is waiting for my documents`
      : viewed
        ? `Explain what it means that ${school} viewed my CUAC record`
      : `Explain what to do after ${school} contacted me for ${program}`,
    localized: {
      zh: {
        title: viewed ? `${school} 已查看你的 CUAC 记录` : waiting ? `${school} 正在等待材料` : `${school} 已联系学生`,
        body: waiting
          ? `${school} 已将 ${zhProgram} ${zhDegree} 标记为等待材料。学生应继续按学校自己的材料要求处理，不通过 CUAC 上传材料。`
          : viewed
            ? `${school} 已打开学校专属 CUAC 记录：${zhProgram} ${zhDegree}。学校可以直接联系学生确认下一步。`
            : `${school} 已完成 ${zhProgram} ${zhDegree} 的首次联系。正式材料应按学校流程提交，不通过 CUAC 上传。`,
        action: "打开申请",
        prompt: waiting
          ? `说明 ${school} 正在等待我的材料时我应该准备什么`
          : viewed
            ? `说明 ${school} 查看我的 CUAC 记录意味着什么`
            : `说明 ${school} 联系我申请 ${zhProgram} 后我应该做什么`,
      },
    },
  };
  if (dataClient?.addNotificationEvent) {
    dataClient.addNotificationEvent(event);
    return;
  }
  try {
    const state = JSON.parse(localStorage.getItem(NOTIFICATION_EVENTS_KEY) || "{}");
    const events = Array.isArray(state.events) ? state.events.filter((item) => item.id !== event.id) : [];
    localStorage.setItem(NOTIFICATION_EVENTS_KEY, JSON.stringify({ events: [event, ...events].slice(0, 20), updatedAt: new Date().toISOString() }));
  } catch {
    // Demo storage can be unavailable in private or restricted preview contexts.
  }
}

function formatProgram(record) {
  const interests = getProgramInterests(record);
  if (interests.length > 1) return `${interests.length} 个项目意向 - ${commonZh(record.intake)} - ${commonZh(record.languageRoute)}`;
  return `${programLabel(record.programName)} ${commonZh(record.degree)} - ${commonZh(record.intake)} - ${commonZh(record.languageRoute)}`;
}

function getProgramInterests(record = {}) {
  if (Array.isArray(record.programInterests) && record.programInterests.length) return record.programInterests;
  const program = record.informationSources?.fromProgramRecord || {};
  return [{
    programId: record.programId || program.id || "",
    programName: record.programName || "Selected program",
    programFullName: record.programFullName || `${record.programName || "Selected program"} ${record.degree || ""}`.trim(),
    degree: record.degree || "Route",
    degreeLevel: record.degreeLevel || program.degreeLevel || record.degree || "Route",
    durationYears: record.durationYears || program.durationYears || "",
    fieldCategory: record.fieldCategory || program.fieldCategory || "",
    intake: record.intake || "Fall 2026",
    languageRoute: record.languageRoute || record.teachingLanguage || "English-taught",
    teachingLanguage: record.teachingLanguage || record.languageRoute || program.teachingLanguage || "English-taught",
    cscaSubjects: record.cscaSubjects || program.cscaSubjects || [],
    cscaRequirement: record.cscaRequirement || program.cscaRequirement || "",
    hskRequirement: record.hskRequirement || program.hskRequirement || "",
    englishRequirement: record.englishRequirement || program.englishRequirement || "",
    tuition: record.tuition || "",
    deadline: record.deadline || "",
    applicationRound: record.applicationRound || program.applicationRound || "",
    applicationUrl: record.applicationUrl || program.applicationUrl || "",
    applicationNote: record.applicationNote || program.applicationNote || "",
    sourceLabel: record.sourceLabel || program.sourceLabel || "",
    studentChoiceNote: record.studentChoiceNote || "",
    informationSources: record.informationSources || null,
  }];
}

function programNamesForRecord(record = {}) {
  return getProgramInterests(record).map((interest) => interest.programName || interest.programFullName || "Selected program");
}

function renderProgramInterestDetail(record = {}) {
  const target = document.querySelector("[data-program-interest]");
  if (!target) return;
  const interests = getProgramInterests(record);
  if (interests.length === 1) {
    const interest = interests[0];
    target.innerHTML = `
      <span class="program-interest-row">
        <strong>${escapeHtml(programLabel(interest.programFullName || interest.programName))}</strong>
        <em>${escapeHtml(commonZh(interest.intake || record.intake))} · ${escapeHtml(commonZh(interest.languageRoute || record.languageRoute))} · ${escapeHtml(commonZh(interest.durationYears || record.durationYears || "学制待确认"))} · ${escapeHtml(commonZh(interest.fieldCategory || record.fieldCategory || "专业方向待确认"))}</em>
      </span>
    `;
    return;
  }
  target.innerHTML = interests
    .map((interest) => `
      <span class="program-interest-row">
        <strong>${escapeHtml(programLabel(interest.programFullName || interest.programName))}</strong>
        <em>${escapeHtml(commonZh(interest.intake || record.intake))} · ${escapeHtml(commonZh(interest.languageRoute || record.languageRoute))} · ${escapeHtml(commonZh(interest.durationYears || "学制待确认"))} · ${escapeHtml(commonZh(interest.deadline || "截止日期待确认"))}</em>
      </span>
    `)
    .join("");
}

function getSchoolRecords() {
  return Object.entries(applications).filter(([, record]) => record.school === SCHOOL_ACCOUNT_NAME);
}

function matchesQuickFilter(record) {
  if (quickFilter === "new") return record.status === "New";
  if (quickFilter === "contacted") return record.status === "Contacted";
  if (quickFilter === "waiting") return record.status === "Waiting for documents";
  return true;
}

function getVisibleApplications() {
  const query = filters.query.trim().toLowerCase();
  return getSchoolRecords()
    .filter(([, record]) => filters.intake === "all" || record.intake === filters.intake)
    .filter(([, record]) => filters.status === "all" || record.status === filters.status)
    .filter(([, record]) => filters.program === "all" || programNamesForRecord(record).includes(filters.program))
    .filter(([, record]) => matchesQuickFilter(record))
    .filter(([, record]) => {
      if (!query) return true;
      return [record.name, ...programNamesForRecord(record), record.country, record.email, record.owner]
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .sort(([, a], [, b]) => {
      if (filters.sort === "received") return new Date(b.receivedAt) - new Date(a.receivedAt);
      if (filters.sort === "owner") return a.owner.localeCompare(b.owner) || new Date(b.receivedAt) - new Date(a.receivedAt);
      if (filters.sort === "status") return a.status.localeCompare(b.status) || new Date(b.receivedAt) - new Date(a.receivedAt);
      return (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9) || new Date(b.receivedAt) - new Date(a.receivedAt);
    });
}

function statusClass(status) {
  if (status === "Contacted") return "contacted";
  if (status === "Waiting for documents") return "waiting";
  return "";
}

function isIncomingSource(source = "") {
  return source === "Live CUAC submission" || source === "CUAC submission";
}

function displayRecordSource(source = "") {
  return sourceLabel(source);
}

function relativeReceived(record) {
  const date = new Date(record.receivedAt);
  const month = date.toLocaleString("zh-CN", { month: "short" });
  const day = `${date.getDate()}日`;
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}${day} ${hours}:${minutes}`;
}

function renderProgramFilter() {
  const select = document.querySelector("[data-program-filter]");
  if (!select) return;
  const programs = [...new Set(getSchoolRecords().flatMap(([, record]) => programNamesForRecord(record)))].sort();
  const previous = filters.program;
  select.innerHTML = `<option value="all">全部项目</option>${programs
    .map((program) => `<option value="${escapeHtml(program)}">${escapeHtml(programLabel(program))}</option>`)
    .join("")}`;
  filters.program = programs.includes(previous) ? previous : "all";
  select.value = filters.program;
}

function renderQueue() {
  const list = document.querySelector("[data-school-list]");
  if (!list) return;
  const entries = getVisibleApplications();
  const visibleIds = new Set(entries.map(([id]) => id));
  selectedRecords = new Set([...selectedRecords].filter((id) => visibleIds.has(id)));
  if (!entries.some(([id]) => id === currentApplication)) currentApplication = entries[0]?.[0] || "";

  list.innerHTML = entries
    .map(([id, record]) => {
      const status = record.status.toLowerCase().replaceAll(" ", "-");
      const active = id === currentApplication ? "active" : "";
      const selected = selectedRecords.has(id) ? "checked" : "";
      const sourceClass = isIncomingSource(record.source) ? "live" : "prepared";
      const programNames = programNamesForRecord(record);
      const programSummary = programNames.length > 1
        ? `${programNames.slice(0, 2).map(programLabel).join(" + ")}${programNames.length > 2 ? ` + 另外 ${programNames.length - 2} 个` : ""}`
        : `${programLabel(record.programName)} ${commonZh(record.degree)}`;
      return `
        <article class="school-application ${active} ${statusClass(record.status)}" data-record-row="${escapeHtml(id)}" data-status="${escapeHtml(status)}">
          <input class="record-select" type="checkbox" aria-label="选择 ${escapeHtml(record.name)}" data-select-record="${escapeHtml(id)}" ${selected} />
          <button class="queue-main" type="button" data-application="${escapeHtml(id)}">
            <strong><span class="status-dot"></span>${escapeHtml(record.name)}</strong>
            <em>${escapeHtml(programSummary)} · ${escapeHtml(commonZh(record.intake))}</em>
            <small>${escapeHtml(countryLabel(record.country))} · ${escapeHtml(commonZh(record.languageRoute))} · ${escapeHtml(dueLabel(record.due))}</small>
            <span class="queue-meta">
              <span class="status-chip ${statusClass(record.status)}">${escapeHtml(statusLabel(record.status))}</span>
              <span class="priority-chip ${record.priority.toLowerCase()}">${escapeHtml(priorityLabel(record.priority))}优先级</span>
              <span class="owner-chip">负责人：${escapeHtml(commonZh(record.owner))}</span>
            </span>
          </button>
          <div class="queue-side">
            <span class="source-chip ${sourceClass}">${displayRecordSource(record.source)}</span>
            <span class="received-time">${escapeHtml(relativeReceived(record))}</span>
          </div>
        </article>
      `;
    })
    .join("");

  document.querySelector("[data-empty-state]")?.toggleAttribute("hidden", entries.length > 0);
  updateSelectionCount();
  renderTeacherOps(entries);
}

function countBy(records, key) {
  return records.reduce((counts, record) => {
    const value = typeof key === "function" ? key(record) : record[key];
    counts.set(value, (counts.get(value) || 0) + 1);
    return counts;
  }, new Map());
}

function setAnalyticsLoading() {
  analyticsTargets.forEach((selector) => {
    const target = document.querySelector(selector);
    if (!target) return;
    target.innerHTML = "";
    target.classList.add("chart-loading");
    target.setAttribute("aria-busy", "true");
  });
}

function finishChartLoading(target) {
  target.classList.remove("chart-loading");
  target.setAttribute("aria-busy", "false");
}

function renderPipeline(targetSelector, counts) {
  const target = document.querySelector(targetSelector);
  if (!target) return;
  finishChartLoading(target);
  const entries = pipelineOrder
    .map((status) => [status, counts.get(status) || 0])
    .filter(([, count]) => count > 0);
  const total = entries.reduce((sum, [, count]) => sum + count, 0) || 1;
  target.innerHTML = entries
    .map(([label, count], index) => {
      const width = Math.max(9, Math.round((count / total) * 100));
      return `
        <div class="pipeline-stage" style="--stage-color: ${chartColors[index % chartColors.length]}; animation-delay: ${index * 60}ms">
          <span>${escapeHtml(statusLabel(label))}</span>
          <div class="stage-rail"><span class="stage-fill" style="width: ${width}%; animation-delay: ${index * 60}ms"></span></div>
          <strong>${count}</strong>
        </div>
      `;
    })
    .join("");
}

function renderColumnChart(targetSelector, counts) {
  const target = document.querySelector(targetSelector);
  if (!target) return;
  finishChartLoading(target);
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = Math.max(...entries.map(([, count]) => count), 1);
  target.innerHTML = entries
    .map(([label, count], index) => {
      const height = Math.max(16, Math.round((count / max) * 100));
      return `
        <div class="column-item" title="${escapeHtml(label)}" style="animation-delay: ${index * 70}ms">
          <div class="column-bar-wrap">
            <span class="column-bar" style="height: ${height}%; --bar-color: ${chartColors[index % chartColors.length]}; animation-delay: ${index * 70}ms">${count}</span>
          </div>
          <span class="column-label">${escapeHtml(programLabel(label))}</span>
        </div>
      `;
    })
    .join("");
}

function renderDonut(targetSelector, counts) {
  const target = document.querySelector(targetSelector);
  if (!target) return;
  finishChartLoading(target);
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  let cursor = 0;
  const gradient = entries
    .map(([, count], index) => {
      const start = cursor;
      const end = total ? cursor + (count / total) * 100 : 100;
      cursor = end;
      return `${chartColors[index % chartColors.length]} ${start}% ${end}%`;
    })
    .join(", ");
  target.innerHTML = `
    <div class="donut-ring" data-total="${total}" style="--donut-gradient: ${gradient || `${chartColors[0]} 0 100%`}"></div>
    <div class="donut-legend">
      ${entries
        .map(
          ([label, count], index) => `
            <div class="legend-row" style="animation-delay: ${180 + index * 55}ms">
              <span class="legend-label"><span class="legend-dot" style="--dot-color: ${chartColors[index % chartColors.length]}"></span>${escapeHtml(label)}</span>
              <strong>${count}</strong>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderCountryList(targetSelector, counts) {
  const target = document.querySelector(targetSelector);
  if (!target) return;
  finishChartLoading(target);
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  target.innerHTML = entries
    .map(
      ([label, count], index) => `
        <div class="country-row" style="animation-delay: ${index * 55}ms">
          <span class="country-label"><span class="country-dot" style="--dot-color: ${chartColors[index % chartColors.length]}"></span>${escapeHtml(countryLabel(label))}</span>
          <strong>${count}</strong>
        </div>
      `,
    )
    .join("");
}

function renderAnalytics() {
  const records = getSchoolRecords()
    .map(([, record]) => record)
    .filter((record) => filters.intake === "all" || record.intake === filters.intake);
  const programCounts = records.reduce((counts, record) => {
    programNamesForRecord(record).forEach((program) => counts.set(program, (counts.get(program) || 0) + 1));
    return counts;
  }, new Map());
  const countryCounts = countBy(records, "country");
  const statusCounts = countBy(records, "status");
  const sourceCounts = countBy(records, (record) => (isIncomingSource(record.source) ? "CUAC 实时提交" : "预置队列"));
  const fundingCounts = countBy(records, (record) => {
    if (record.funding.toLowerCase().includes("scholarship") || record.funding.toLowerCase().includes("csc")) return "奖学金意向";
    if (record.funding.toLowerCase().includes("self")) return "自费";
    return "资金敏感";
  });

  clearTimeout(analyticsRenderTimer);
  setAnalyticsLoading();
  analyticsRenderTimer = setTimeout(() => {
    document.querySelector("[data-program-total]").textContent = `${programCounts.size} 个方向`;
    document.querySelector("[data-country-total]").textContent = `${countryCounts.size} 个地区`;
    document.querySelector("[data-status-total]").textContent = `${records.length} 条记录`;
    document.querySelector("[data-funding-total]").textContent = `${fundingCounts.size} 类意向`;
    document.querySelector("[data-source-total]").textContent = `${records.length} 条记录`;
    renderPipeline("[data-analytics-status]", statusCounts);
    renderColumnChart("[data-analytics-programs]", programCounts);
    renderDonut("[data-analytics-funding]", fundingCounts);
    renderDonut("[data-analytics-source]", sourceCounts);
    renderCountryList("[data-analytics-countries]", countryCounts);
  }, 180);
}

function updateMetrics() {
  const records = getSchoolRecords()
    .map(([, record]) => record)
    .filter((record) => filters.intake === "all" || record.intake === filters.intake);
  const newCount = records.filter((record) => record.status === "New").length;
  const needContact = records.filter((record) => !["Contacted", "Waiting for documents", "Documents received by school"].includes(record.status)).length;
  const waitingCount = records.filter((record) => record.status === "Waiting for documents").length;
  const contactedWeek = records.filter((record) => ["Contacted", "Waiting for documents"].includes(record.status)).length;
  const liveCount = records.filter((record) => record.source === "Live CUAC submission").length;
  document.querySelector("[data-school-view-name]").textContent = schoolLabel(currentSchool);
  document.querySelector("[data-school-record-count]").textContent = `${records.length} 条记录`;
  document.querySelector("[data-new-count]").textContent = newCount;
  document.querySelector("[data-contact-count]").textContent = needContact;
  document.querySelector("[data-waiting-count]").textContent = waitingCount;
  document.querySelector("[data-contacted-week]").textContent = contactedWeek;
  document.querySelector("[data-live-count]").textContent = liveCount;
}

function renderOpsRows(target, rows, emptyText) {
  if (!target) return;
  target.innerHTML = rows.length
    ? rows.map(([label, value, tone]) => `
      <div class="ops-row ${tone || ""}">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `).join("")
    : `<div class="ops-row muted"><span>${escapeHtml(emptyText)}</span><strong>0</strong></div>`;
}

function renderTeacherOps(entries = getVisibleApplications()) {
  const records = entries.map(([, record]) => record);
  const ownerCounts = [...countBy(records, "owner").entries()].sort((a, b) => b[1] - a[1]);
  const actionRows = records
    .filter((record) => !["Contacted", "Waiting for documents"].includes(record.status))
    .slice(0, 3)
    .map((record) => [record.name, dueLabel(record.due).replace(/^截止：/, ""), record.priority === "High" ? "urgent" : ""]);

  renderOpsRows(
    document.querySelector("[data-owner-workload]"),
    ownerCounts.map(([owner, count]) => [commonZh(owner), `${count} 条记录`]),
    "当前视图没有负责人",
  );
  renderOpsRows(
    document.querySelector("[data-next-action-queue]"),
    actionRows,
    "暂无首次联系任务",
  );

  const exportCount = records.length;
  setText("[data-export-scope]", `${exportCount} 条可见记录`);
  setText("[data-export-note]", `${schoolLabel(SCHOOL_ACCOUNT_NAME)}租户范围，其他学校选择不可见。`);

  const selected = applications[currentApplication];
  const requested = selected?.notCollectedByCuac || selected?.informationSources?.notCollectedByCuac || ["transcriptFile", "passportScan", "languageCertificateFile"];
  setText("[data-template-summary]", `${requested.length} 项学校需索取材料`);
  setText("[data-template-note]", requested.slice(0, 3).map(fieldLabel).join(" · "));
}

function renderSubmissionReceipt() {
  const tenantRecords = getTenantSubmittedRecords();
  const banner = document.querySelector("[data-submission-receipt]");
  if (!banner || tenantRecords.length === 0) return;
  banner.hidden = false;
  document.querySelector("[data-submission-receipt-copy]").textContent =
    `${schoolLabel(SCHOOL_ACCOUNT_NAME)}已收到 ${tenantRecords.length} 条 CUAC 记录。本门户不会显示学生申请的其他学校。`;
}

function renderPortalWaitingState() {
  const hasLiveSubmission = getTenantSubmittedRecords().length > 0;
  document.querySelector("[data-portal-waiting-state]")?.toggleAttribute("hidden", hasLiveSubmission);
  document.querySelector("[data-prepared-note]")?.toggleAttribute("hidden", hasLiveSubmission);
}

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function fieldLabel(value) {
  if (fieldZh[value]) return fieldZh[value];
  return String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/File$/i, "")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderInformationSources(record) {
  const target = document.querySelector("[data-information-sources]");
  const notCollected = document.querySelector("[data-not-collected]");
  const sources = record.informationSources || {};
  const program = sources.fromProgramRecord || {};
  const school = sources.fromSchoolRecord || {};
  const profile = sources.fromStudentProfile || {};
  const choiceNote = record.studentChoiceNote || sources.selectedByStudent?.studentChoiceNote || "";
  const interests = getProgramInterests(record);
  const primaryInterest = interests[0] || {};
  const sourceInterests = interests.length ? interests : [primaryInterest];
  const uniqueText = (items = []) => [...new Set(items.filter(Boolean))].join(" · ");
  const interestSummary = interests
    .map((interest) => `${interest.programFullName || interest.programName}${interest.studentChoiceNote ? ` (${interest.studentChoiceNote})` : ""}`)
    .join(" · ");
  const routeSummary = uniqueText(sourceInterests.map((interest) => [
    interest.programFullName || interest.programName,
    interest.degreeLevel || interest.degree || program.degreeLevel || record.degreeLevel,
    interest.durationYears || program.durationYears || record.durationYears,
    interest.fieldCategory || program.fieldCategory || record.fieldCategory,
    interest.applicationRound || program.applicationRound || record.applicationRound,
  ].filter(Boolean).map(commonZh).join(" · "))) || "项目路线待确认";
  const cscaSummary = uniqueText(sourceInterests.map((interest) => [
    interest.programFullName || interest.programName,
    listText(interest.cscaSubjects || program.cscaSubjects, ""),
    interest.cscaRequirement || program.cscaRequirement || record.cscaRequirement,
  ].filter(Boolean).map(commonZh).join(" · "))) || "学校按项目确认 CSCA 要求";
  const languageSummary = uniqueText(sourceInterests.map((interest) => [
    interest.programFullName || interest.programName,
    interest.englishRequirement || program.englishRequirement || record.englishRequirement,
    interest.hskRequirement || program.hskRequirement || record.hskRequirement,
  ].filter(Boolean).map(commonZh).join(" · "))) || "学校按项目确认语言证明";
  const applicationSummary = uniqueText(sourceInterests.map((interest) => [
    interest.programFullName || interest.programName,
    interest.applicationNote || program.applicationNote || record.applicationNote,
    interest.applicationUrl || program.applicationUrl || record.applicationUrl || school.applicationSystemUrl || school.admissionsWebsiteUrl,
    interest.sourceLabel || program.sourceLabel || record.sourceLabel,
  ].filter(Boolean).map(commonZh).join(" · "))) || "学校联系学生后确认官方申请路径";
  const scholarships = record.scholarshipSignals || sources.fromSchoolScholarshipRecords || [];
  const scholarshipSummary = scholarships.length
    ? scholarships.map((item) => item.name || item.coverage).filter(Boolean).join(" · ")
    : record.schoolScholarshipSummary || "未关联本校奖学金记录";
  const sourceSummaryParts = [
    `${schoolLabel(record.school || SCHOOL_ACCOUNT_NAME)}路线`,
    program.nameEn || record.programFullName || formatProgram(record),
    countryLabel(profile.country || record.country),
  ].filter(Boolean);
  const profileCodes = [
    profile.countryCode || record.countryCode,
    profile.nationalityCode || record.nationalityCode,
    profile.gradeCode || record.gradeCode,
    profile.currentOrganizationId || record.currentOrganizationId ? `机构 ${profile.currentOrganizationId || record.currentOrganizationId}` : "",
    profile.updatedAt || record.studentProfileUpdatedAt ? `更新 ${String(profile.updatedAt || record.studentProfileUpdatedAt).slice(0, 10)}` : "",
  ].filter(Boolean).map(commonZh).join(" · ");
  setText("[data-source-summary]", sourceSummaryParts.slice(0, 3).map(commonZh).join(" · ") || "学生选择、CUAC 目录和学生资料");

  if (target) {
    target.innerHTML = `
      <article>
        <span>学生选择</span>
        <em>${escapeHtml(schoolLabel(school.nameEn || record.school))} · ${escapeHtml(commonZh(interestSummary || program.nameEn || record.programFullName || formatProgram(record)))}</em>
        <small>${choiceNote ? `主要备注：${escapeHtml(commonZh(choiceNote))}` : "没有额外学生备注"}</small>
      </article>
      <article>
        <span>项目路线</span>
        <em>${escapeHtml(routeSummary)}</em>
      </article>
      <article>
        <span>入学要求</span>
        <em>${escapeHtml(cscaSummary)} · ${escapeHtml(languageSummary)}</em>
      </article>
      <article>
        <span>学校申请入口</span>
        <em>${escapeHtml(applicationSummary)}</em>
      </article>
      <article>
        <span>CUAC 目录</span>
        <em>${escapeHtml(commonZh(program.deadlineLabel || record.deadline))} · ${escapeHtml(commonZh(program.tuitionText || record.tuition || "学费待确认"))} · ${escapeHtml(commonZh(program.sourceLabel || record.sourceLabel || "CUAC 目录"))}</em>
      </article>
      <article>
        <span>资金背景</span>
        <em>${escapeHtml(commonZh(scholarshipSummary))}</em>
      </article>
      <article>
        <span>学生资料</span>
        <em>${escapeHtml(profile.legalName || record.name)} · ${escapeHtml(countryLabel(profile.country || record.country))} · ${escapeHtml(commonZh(profile.grade || record.grade || record.stage || "阶段未提供"))} · ${escapeHtml(commonZh(profile.currentSchool || record.currentSchool || "未提供学校"))} · ${escapeHtml(commonZh(profile.languageTests || record.language))}${profileCodes ? ` · ${escapeHtml(profileCodes)}` : ""}</em>
      </article>
    `;
  }

  if (notCollected) {
    const missingFiles = record.notCollectedByCuac || sources.notCollectedByCuac || ["transcriptFile", "passportScan", "languageCertificateFile"];
    notCollected.innerHTML = `
      <span>CUAC 未收取文件</span>
      ${missingFiles.map((item) => `<em>${escapeHtml(fieldLabel(item))}</em>`).join("")}
    `;
  }
}

function setDetail(id) {
  const record = applications[id];
  if (!record) return;
  currentApplication = id;
  setText("[data-student-name]", record.name);
  setText("[data-detail-source]", displayRecordSource(record.source));
  setText("[data-detail-status]", statusLabel(record.status));
  setText("[data-priority]", `${priorityLabel(record.priority)}优先级`);
  setText("[data-owner]", `负责人：${commonZh(record.owner)}`);
  setText("[data-next-action]", commonZh(record.nextAction));
  setText("[data-due-date]", dueLabel(record.due));
  setText("[data-country]", countryLabel(record.country));
  setText("[data-passport-nationality]", countryLabel(record.passportNationality));
  setText("[data-email]", record.email);
  setText("[data-phone]", record.phone);
  setText("[data-stage]", commonZh(record.stage));
  setText("[data-current-school]", commonZh(record.currentSchool));
  setText("[data-intended-level]", commonZh(record.intendedLevel));
  setText("[data-guardian-status]", commonZh(record.guardianStatus));
  renderProgramInterestDetail(record);
  setText("[data-funding]", commonZh(record.funding));
  setText("[data-language]", commonZh(record.language));
  setText("[data-deadline]", commonZh(record.deadline));
  setText("[data-fit]", commonZh(record.fit));
  setText("[data-academic-summary]", commonZh(record.academicSummary));
  setText("[data-note-text]", commonZh(record.note));
  renderInformationSources(record);

  const emailLink = document.querySelector("[data-email-link]");
  if (emailLink) emailLink.href = `mailto:${record.email}`;

  const timeline = document.querySelector("[data-timeline]");
  if (timeline) timeline.innerHTML = record.timeline.map((item) => `<li>${escapeHtml(commonZh(item))}</li>`).join("");

  const statusChip = document.querySelector("[data-detail-status]");
  statusChip?.classList.toggle("contacted", record.status === "Contacted");
  statusChip?.classList.toggle("waiting", record.status === "Waiting for documents");
  const priorityChip = document.querySelector("[data-priority]");
  priorityChip?.classList.toggle("high", record.priority === "High");
  priorityChip?.classList.toggle("normal", record.priority === "Normal");

  document.querySelectorAll("[data-record-row]").forEach((row) => {
    row.classList.toggle("active", row.dataset.recordRow === id);
  });
  renderTeacherOps(getVisibleApplications());
}

function updateSelectionCount() {
  setText("[data-selection-count]", `已选择 ${selectedRecords.size} 条`);
}

function applyFilter(filter) {
  quickFilter = filter;
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === filter);
  });
  renderQueue();
  setDetail(currentApplication);
}

function showPortalToast(message) {
  const toast = document.querySelector("[data-portal-toast]");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showPortalToast.timer);
  showPortalToast.timer = setTimeout(() => {
    toast.hidden = true;
  }, 2400);
}

function markRecordContacted(id) {
  const record = applications[id];
  if (!record) return;
  record.status = "Contacted";
  record.timeline = [...record.timeline.filter((item) => item !== "First contact not started"), "学校已标记首次联系完成"];
  record.nextAction = "等待学生通过学校流程回复正式申请材料。";
  record.due = "Due: this week";
  persistSchoolFollowup(record, "contacted", "School contacted student directly");
  addSchoolContactNotification(record);
}

function bulkMarkContacted() {
  if (selectedRecords.size === 0) {
    showPortalToast("请先选择一条或多条记录，再使用批量操作。");
    return;
  }
  selectedRecords.forEach((id) => markRecordContacted(id));
  showPortalToast(`已为 ${selectedRecords.size} 条记录加入联系队列，学生端将显示已联系状态。`);
  selectedRecords = new Set();
  updateMetrics();
  renderAnalytics();
  renderQueue();
  setDetail(currentApplication);
}

function persistTenantExport(source = "manual") {
  const state = readSchoolPortalDemoState() || {};
  const visibleRecords = getVisibleApplications();
  const exportedAt = new Date().toISOString();
  const exportEvent = {
    id: `tenant-export-${SCHOOL_ACCOUNT_NAME.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
    school: SCHOOL_ACCOUNT_NAME,
    scope: "tenant-only",
    source,
    recordCount: visibleRecords.length,
    visibleRecordIds: visibleRecords.map(([id]) => id),
    filters: { ...filters, quickFilter },
    fields: ["student", "program", "country", "email", "status", "owner", "priority", "source"],
    exportedAt,
  };
  const exportEvents = [exportEvent, ...(Array.isArray(state.exportEvents) ? state.exportEvents : [])].slice(0, 8);
  try {
    localStorage.setItem(
      SCHOOL_PORTAL_DEMO_STATE_KEY,
      JSON.stringify({
        ...state,
        lastExport: exportEvent,
        exportEvents,
        updatedAt: exportedAt,
      }),
    );
  } catch {
    // Demo storage can be unavailable in private or restricted preview contexts.
  }
  return exportEvent;
}

function exportCsvMock(source = "manual") {
  const exportEvent = persistTenantExport(source);
  showPortalToast(`已为${schoolLabel(exportEvent.school)}准备 CSV 导出（${exportEvent.recordCount} 条可见记录）。`);
}

function copyRequestTemplate() {
  showPortalToast("材料请求模板已复制。CUAC 未收取文件。");
}

function renderAll() {
  renderProgramFilter();
  updateMetrics();
  renderAnalytics();
  renderQueue();
  setDetail(currentApplication);
}

document.addEventListener("click", (event) => {
  const application = event.target.closest("[data-application]");
  if (application) setDetail(application.dataset.application);

  const filter = event.target.closest("[data-filter]");
  if (filter) applyFilter(filter.dataset.filter);

  const contacted = event.target.closest("[data-mark-contacted]");
  if (contacted) {
    markRecordContacted(currentApplication);
    showPortalToast("已标记联系。学生端 Hub 将显示已联系状态。");
    updateMetrics();
    renderAnalytics();
    renderQueue();
    setDetail(currentApplication);
    applyFilter(document.querySelector("[data-filter].active")?.dataset.filter || "all");
  }

  const waiting = event.target.closest("[data-mark-waiting]");
  if (waiting) {
    const record = applications[currentApplication];
    record.status = "Waiting for documents";
    record.timeline = [...record.timeline, "学校正在等待材料"];
    record.nextAction = "等待护照、成绩单、语言证明和学校专属表格。";
    record.due = "Due: this week";
    persistSchoolFollowup(record, "waiting-documents", "Waiting for documents");
    addSchoolContactNotification(record, "waiting-documents");
    showPortalToast("记录已移至等待材料，学生端将显示材料跟进状态。");
    updateMetrics();
    renderAnalytics();
    renderQueue();
    setDetail(currentApplication);
  }

  const bulkContact = event.target.closest("[data-bulk-contact]");
  if (bulkContact) bulkMarkContacted();

  const exportCsv = event.target.closest("[data-export-csv]");
  if (exportCsv) exportCsvMock("manual");

  const copy = event.target.closest("[data-copy-request], [data-copy-bulk-request]");
  if (copy) {
    copy.textContent = "已复制";
    copyRequestTemplate();
    setTimeout(() => {
      copy.textContent = copy.matches("[data-copy-bulk-request]") ? "复制请求模板" : "复制材料请求";
    }, 1400);
  }
});

document.addEventListener("cuac:agent-action", (event) => {
  const action = event.detail?.action || "";
  if (action === "school-copy-request-template") {
    copyRequestTemplate();
    event.preventDefault();
    return;
  }
  if (action === "school-bulk-contact") {
    bulkMarkContacted();
    event.preventDefault();
    return;
  }
  if (action === "school-export-csv") {
    exportCsvMock("agent");
    event.preventDefault();
  }
});

document.addEventListener("change", (event) => {
  const selected = event.target.closest("[data-select-record]");
  if (selected) {
    if (selected.checked) selectedRecords.add(selected.dataset.selectRecord);
    else selectedRecords.delete(selected.dataset.selectRecord);
    updateSelectionCount();
  }

  const status = event.target.closest("[data-status-filter]");
  if (status) {
    filters.status = status.value;
    renderQueue();
    setDetail(currentApplication);
  }

  const program = event.target.closest("[data-program-filter]");
  if (program) {
    filters.program = program.value;
    renderQueue();
    setDetail(currentApplication);
  }

  const intake = event.target.closest("[data-intake-filter]");
  if (intake) {
    filters.intake = intake.value;
    renderAll();
  }

  const sort = event.target.closest("[data-sort]");
  if (sort) {
    filters.sort = sort.value;
    renderQueue();
    setDetail(currentApplication);
  }
});

document.addEventListener("input", (event) => {
  const search = event.target.closest("[data-portal-search]");
  if (!search) return;
  filters.query = search.value;
  renderQueue();
  setDetail(currentApplication);
});

hydrateSubmittedRecords();
markLiveRecordsViewed();
renderPortalWaitingState();
renderSubmissionReceipt();
renderAll();
