CREATE TABLE "public_guides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title_en" text NOT NULL,
	"title_zh" text,
	"subtitle_en" text,
	"subtitle_zh" text,
	"summary_en" text,
	"summary_zh" text,
	"href" text NOT NULL,
	"search_terms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"verification_status" text DEFAULT 'unverified' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_guides_status_check" CHECK ("public_guides"."status" in ('draft','published','archived')),
	CONSTRAINT "public_guides_verification_check" CHECK ("public_guides"."verification_status" in ('unverified','verified')),
	CONSTRAINT "public_guides_publication_check" CHECK (("public_guides"."status" = 'draft' and "public_guides"."published_at" is null)
      or ("public_guides"."status" in ('published','archived') and "public_guides"."published_at" is not null)),
	CONSTRAINT "public_guides_version_check" CHECK ("public_guides"."version" between 1 and 2147483647),
	CONSTRAINT "public_guides_href_check" CHECK ("public_guides"."href" ~ '^guide(s|-detail)\.html([?#].*)?$' and "public_guides"."href" !~ '[[:cntrl:]]')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "public_guides_slug_unique" ON "public_guides" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "public_guides_status_idx" ON "public_guides" USING btree ("status","sort_order");--> statement-breakpoint
CREATE INDEX "public_guides_public_search_trgm_idx" ON "public_guides" USING gin ((
      coalesce(lower("title_en"), '') || ' ' || coalesce(lower("title_zh"), '') || ' ' ||
      coalesce(lower("subtitle_en"), '') || ' ' || coalesce(lower("subtitle_zh"), '') || ' ' ||
      coalesce(lower("summary_en"), '') || ' ' || coalesce(lower("summary_zh"), '') || ' ' ||
      lower("search_terms"::text)
    ) gin_trgm_ops) WHERE "public_guides"."status" = 'published';
--> statement-breakpoint
CREATE TRIGGER "public_guides_public_catalog_revision_trigger"
AFTER INSERT OR UPDATE OR DELETE ON "public_guides"
FOR EACH STATEMENT EXECUTE FUNCTION "bump_public_catalog_revision"();
--> statement-breakpoint
INSERT INTO "public_guides" (
  "id", "slug", "title_en", "title_zh", "subtitle_en", "subtitle_zh", "summary_en", "summary_zh",
  "href", "search_terms", "status", "verification_status", "sort_order", "published_at"
) VALUES
  ('50000000-0000-4000-8000-000000000001', 'timeline', 'China Application Timeline', '中国留学申请时间线',
   'Fall, spring, and late intake planning', '秋季、春季与晚轮申请规划',
   'Plan application windows, requirement checks, school follow-up, and arrival steps while confirming each official deadline.',
   '规划申请窗口、要求核对、学校跟进和抵达步骤，并逐项确认官方截止日期。',
   'guides.html#timeline', '["deadline","intake","application window","申请时间","截止日期"]'::jsonb, 'published', 'verified', 10, '2026-09-15T00:00:00Z'),
  ('50000000-0000-4000-8000-000000000002', 'documents', 'China Application Document Checklist', '中国留学申请材料清单',
   'Reusable, translated, and checked', '可复用、已翻译、已核对',
   'Understand which documents students prepare and which official materials schools request directly outside the current CUAC platform.',
   '了解学生需要准备哪些材料，以及学校会在当前 CUAC 平台之外直接要求哪些官方文件。',
   'guide-detail.html?guide=documents', '["passport","transcript","translation","IELTS","HSK","材料","护照","成绩单"]'::jsonb, 'published', 'verified', 20, '2026-09-15T00:00:00Z'),
  ('50000000-0000-4000-8000-000000000003', 'language', 'English and Chinese Language Routes', '英文授课与中文授课语言路径',
   'HSK, IELTS, TOEFL, interviews, and waivers', 'HSK、IELTS、TOEFL、面试与豁免',
   'Compare teaching language with the proof, interview, placement, and waiver rules required by each school and program.',
   '区分授课语言与各学校、项目要求的语言证明、面试、分班和豁免规则。',
   'guides.html#language', '["english-taught","chinese-taught","language proof","语言要求","英语授课","中文授课"]'::jsonb, 'published', 'verified', 30, '2026-09-15T00:00:00Z'),
  ('50000000-0000-4000-8000-000000000004', 'scholarship-planning', 'Scholarship Planning Guide', '奖学金规划指南',
   'Coverage, eligibility, source, and deadline', '资助范围、资格、来源与截止日期',
   'Compare funding coverage, eligibility, official notices, timing, and realistic backup routes without treating an award as guaranteed.',
   '比较资助范围、申请资格、官方通知、时间安排和现实备选路径，不把奖学金视为保证。',
   'guides.html#scholarships', '["funding","CSC","tuition waiver","stipend","奖学金","资助","学费减免"]'::jsonb, 'published', 'verified', 40, '2026-09-15T00:00:00Z'),
  ('50000000-0000-4000-8000-000000000005', 'visa-arrival', 'Visa and Arrival Steps', '签证与抵达步骤',
   'Admission notice, JW form, X visa, and registration', '录取通知、JW 表、X 签证与报到',
   'Review the typical post-offer sequence and confirm current embassy, university, health-check, and residence-permit requirements.',
   '查看录取后的典型流程，并确认当前使领馆、学校、体检和居留许可要求。',
   'guides.html#visa', '["JW201","JW202","X1","X2","residence permit","签证","入境","居留许可"]'::jsonb, 'published', 'verified', 50, '2026-09-15T00:00:00Z');
