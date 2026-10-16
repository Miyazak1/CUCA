import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";
const root=process.cwd(),manifestPath=resolve(root,"work/catalog-official/2026-10-16T06-45-30-565Z/manifest.json"),candidatePath=resolve(root,"seeds/catalog.sanya-complete-batch-01.draft.json"),validationPath=resolve(root,"seeds/catalog.sanya-complete-batch-01.validation.json");
const manifestText=await readFile(manifestPath,"utf8"),manifest=JSON.parse(manifestText) as {generatedAt:string;sources:Array<{id:string;status:number;finalUrl:string;label:string;sha256:string;fetchedAt:string}>}; const source=manifest.sources.find(x=>x.id==="sanya-university-international-admissions-2026-2027"); if(!source||source.status!==200||source.sha256!=="5d732553c974c1e8035f15fd37972fbb0cc8018d00c9de2bdd54345bb740010e") throw new Error("University of Sanya evidence mismatch.");
const schoolSlug="university-of-sanya",citySlug="sanya",evidence={sourceUrl:source.finalUrl,sourceLabel:source.label,sourceSha256:source.sha256,capturedAt:source.fetchedAt},slug=(s:string)=>s.toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
type Spec=readonly[nameZh:string,nameEn:string,years:number,category:string,tuition:number];
const undergraduate:Spec[]=`会计学|Accounting|Management|36900
财务管理|Financial Management|Management|36900
法学|Law|Law|33900
法学（自贸港法律）|Law (Free Trade Port Laws)|Law|36900
工商管理|Business Administration|Management|31900
市场营销（数字营销）|Marketing (Digital Marketing)|Management|33900
人力资源管理|Human Resource Management|Management|33900
供应链管理|Supply Chain Management|Management|33900
跨境电子商务|Cross-border E-commerce|Management|33900
医学检验技术|Medical Laboratory Technique|Medicine|33900
康复治疗学|Rehabilitation Therapeutics|Medicine|33900
护理学|Nursing|Medicine|33900
健康服务与管理|Health Service and Management|Management|31900
旅游管理（智慧旅游大数据）|Tourism Management (Smart Tourist Data)|Management|33900
酒店管理（奢华品牌运营与管理）|Hotel Management (Luxury Brand Operations and Management)|Management|31900
汉语言文学|Chinese Language and Literature|Literature|31900
汉语国际教育|Teaching Chinese to Speakers of Other Languages|Literature|31900
语言学（语言科技）|Linguistics (Language Science and Technology)|Literature|36900
网络与新媒体|Network and New Media|Literature|36900
时尚传播|Fashion Communication|Literature|36900
播音与主持艺术|Art of Broadcasting and Hosting|Arts|36900
社会学|Sociology|Law|33900
社会工作|Social Work|Law|33900
应用心理学|Applied Psychology|Science|33900
数字经济|Digital Economy|Economics|48000
投资学（量化投资）|Science of Investment (Quantitative Investment)|Economics|48000
经济与金融|Economics and Finance|Economics|36900
金融科技|Financial Technology|Economics|48000
国际经济与贸易|International Economics and Trade|Economics|31900
武术与民族传统体育|Wushu and National Traditional Sports|Education|31900
休闲体育|Leisure Sports|Education|31900
电子竞技运动与管理|E-Sports and Management|Education|33900
英语|English|Literature|33900
俄语|Russian|Literature|31900
车辆工程（新能源）|Vehicle Engineering (New Energy)|Engineering|36900
新能源汽车工程|New Energy Automobile Engineering|Engineering|36900
新能源科学与工程|New Energy Science and Engineering|Engineering|36900
储能科学与工程|Energy Storage Science and Engineering|Engineering|36900
电子信息工程|Electronic Information Engineering|Engineering|36900
通信工程|Communication Engineering|Engineering|36900
集成电路设计与集成系统|Integrated Circuit Design and Integrated Systems|Engineering|36900
计算机科学与技术|Computer Science and Technology|Engineering|33900
软件工程|Software Engineering|Engineering|33900
智能科学与技术|Intelligent Science and Technology|Engineering|36900
数据科学与大数据技术|Data Science and Big Data Technology|Engineering|36900
数字媒体艺术|Digital Media Art|Arts|36900
视觉传达设计|Visual Communication Design|Arts|36900
环境设计|Environmental Design|Arts|33900
产品设计|Product Design|Arts|36900
音乐表演|Musical Performance|Arts|36900
舞蹈编导|Choreography|Arts|36900`.split("\n").map(x=>{const[a,b,c,d]=x.split("|");return[a,b,4,c,Number(d)] as Spec;});
const masters:Spec[]=`社会工作|Master of Social Work|2|Law
旅游管理|Master of Tourism Administration|2|Management
电子信息|Master of Electronic Information|3|Engineering
国际商务|Master of International Business|2|Management
金融|Master of Finance|3|Economics
设计|Master of Design|3|Arts
音乐|Master of Music|3|Arts
国际中文教育|Master of Teaching Chinese to Speakers of Other Languages|2|Literature
应用心理|Master of Applied Psychology|2|Science
翻译|Master of Translation and Interpreting|2|Literature`.split("\n").map(x=>{const[a,b,c,d]=x.split("|");return[a,b,Number(c),d,28000] as Spec;});
const make=(rows:Spec[],degreeLevel:"Undergraduate"|"Master"):CatalogSeedProgram[]=>rows.map(([nameZh,nameEn,durationYears,fieldCategory,tuitionAmount])=>({slug:`${schoolSlug}-${degreeLevel.toLowerCase()}-${slug(nameEn)}`,schoolSlug,citySlug,nameEn,nameZh,degreeLevel,durationYears,fieldCategory,subjectArea:nameEn,teachingLanguage:"Chinese",hskRequirement:degreeLevel==="Undergraduate"?"HSK Level 4; certificate valid for two years.":"HSK Level 5; certificate valid for two years.",tuitionAmount,tuitionCurrency:"CNY",tuitionPeriod:"year",tuitionText:`CNY ${tuitionAmount.toLocaleString("en-US")}/year`,applicationNote:"Application materials are submitted by email to the International Department; no HTTPS application portal is published.",hasScholarship:true,status:"draft",...evidence,sourceFieldLineage:{nameZh:"Annex program table",nameEn:"Annex bilingual program table",degreeLevel:"Annex table heading",durationYears:degreeLevel==="Undergraduate"?"Admission information":"Master program table",teachingLanguage:"Admission information",hskRequirement:"Eligibility Criteria",tuitionText:"Annex program table"}}));
const programs=[...make(undergraduate,"Undergraduate"),...make(masters,"Master")],programIntakes=programs.map(p=>({programSlug:p.slug,intakeTerm:"Fall",intakeYear:2026,deadlineDate:"2026-05-01T15:59:59.000Z",deadlineLabel:"May 1, 2026",applicationRound:"2026-2027 international admissions",status:"closed" as const,...evidence,sourceFieldLineage:{intakeYear:"guide title and admission information",deadlineDate:"Application Period and Submission"}}));
const scholarship={slug:"university-of-sanya-hainan-government-scholarship-2026",title:"Hainan Provincial Government Scholarship at University of Sanya",schoolSlug,type:"government",typeLabel:"Provincial government scholarship",providerName:"海南省政府",providerNameEn:"Hainan Provincial Government",providerLocation:"Hainan, China",fundingLevel:"One scholarship slot",coverage:"One scholarship slot is available for an undergraduate or postgraduate program; the reviewed guide does not publish the award amount or itemized coverage.",applicableDegree:"Undergraduate or Master",deadlineLabel:"May 1, 2026 admissions deadline",applicationRound:"2026-2027 international admissions",targetCountries:[] as string[],targetRegions:[] as string[],eligibilityItems:[{label:"Annual review",value:"Recipients must pass the annual review to continue receiving the scholarship in the following academic year."}],applicationSteps:[{label:"Submit",value:"Submit the admission materials by the published deadline; qualified scholarship applicants receive a pre-admission notice by email."}],actionLinks:[{label:source.label,url:source.finalUrl,kind:"official-source" as const}],summary:"One provincial scholarship place is available across the undergraduate and graduate intake, subject to annual review.",status:"draft" as const,...evidence,sourceFieldLineage:{title:"Admission information / Scholarship",fundingLevel:"Admission information / Enrollment quota and Scholarship",coverage:"Admission information / Scholarship",applicableDegree:"Admission information / Scholarship",deadlineLabel:"Application Period and Submission"}};
const candidate:CatalogSeedBundle={version:1,generatedAt:manifest.generatedAt,cities:[{slug:citySlug,nameEn:"Sanya",nameZh:"三亚",province:"Hainan",region:"South China",status:"draft",verificationStatus:"unverified",...evidence,sourceFieldLineage:{nameEn:"University overview",nameZh:"guide title",province:"University overview",region:"CUAC geographic taxonomy"}}],schools:[{slug:schoolSlug,nameEn:"University of Sanya",nameZh:"三亚学院",citySlug,schoolType:"Private",region:"Sanya, Hainan, South China",applicationLevel:"Undergraduate and Master",languageOfInstruction:"Chinese for all listed undergraduate and graduate programs",languageRequirement:"Undergraduate HSK 4; graduate HSK 5; certificates valid for two years.",hskRequirement:"HSK 4 undergraduate; HSK 5 graduate.",deadlineSummary:"May 1, 2026; the reviewed cycle is closed.",tuitionSummary:"Undergraduate CNY 31,900-48,000/year by program; master CNY 28,000/year.",applicationFee:"CNY 400 registration fee",websiteUrl:"https://www.sanyau.edu.cn/",admissionsUrl:source.finalUrl,subjectTags:[...new Set([...undergraduate,...masters].map(x=>x[3]))],languageTags:["Chinese","HSK 4","HSK 5"],campusHighlights:["Sanya, Hainan tropical campus","51 undergraduate programs","10 master's programs"],status:"draft",...evidence,sourceFieldLineage:{nameEn:"guide title",nameZh:"annex title",citySlug:"University overview",schoolType:"University overview",applicationLevel:"guide title and annexes",languageRequirement:"Eligibility Criteria",deadlineSummary:"Application Period and Submission",tuitionSummary:"Annex program tables",applicationFee:"Admission information",websiteUrl:"Contact Information",admissionsUrl:"registered official guide"}}],programs,programIntakes,scholarships:[scholarship]};
const candidateText=`${JSON.stringify(candidate,null,2)}\n`,validation=createCatalogMigrationValidationReport(JSON.parse(candidateText));if(!validation.ok)throw new Error(validation.errors.join("\n"));const sha256=(v:string)=>createHash("sha256").update(v).digest("hex");const artifact={...validation,candidateSha256:sha256(candidateText),manifestSha256:sha256(manifestText),sourceReview:{status:"unreviewed_draft",notes:["All 51 undergraduate and 10 master's rows, durations and tuition values are transcribed from the official annex tables.","All listed degree programs are explicitly Chinese-taught.","The source publishes only an email submission route, so applicationUrl remains absent.","The Hainan scholarship amount and itemized coverage are not published and remain unresolved."]},publicationAuthorized:false,databaseWriteAuthorized:false};await Promise.all([writeFile(candidatePath,candidateText,"utf8"),writeFile(validationPath,`${JSON.stringify(artifact,null,2)}\n`,"utf8")]);console.log(JSON.stringify({ok:true,summary:validation.summary},null,2));
