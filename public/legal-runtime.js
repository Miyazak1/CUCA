(function () {
  const root = document.querySelector("[data-legal-document]");
  if (!root) return;

  const allowedLocales = new Set(["en", "zh-CN"]);
  const params = new URLSearchParams(window.location.search);
  const requestedLocale = params.get("lang") || root.dataset.defaultLocale || "en";
  const locale = allowedLocales.has(requestedLocale) ? requestedLocale : "en";
  const key = root.dataset.noticeKey;
  const status = root.querySelector("[data-legal-status]");
  const sections = root.querySelector("[data-legal-sections]");
  const localeSelect = root.querySelector("[data-legal-locale]");
  const pageCopy = {
    privacy_notice: {
      en: ["Privacy", "Privacy Notice", "How CUAC handles personal information across student, school and operations workspaces."],
      "zh-CN": ["隐私", "隐私声明", "CUAC 如何在学生、学校和运营工作区处理个人信息。"],
    },
    terms_of_service: {
      en: ["Terms", "Terms of Service", "The rules governing access to and use of CUAC services."],
      "zh-CN": ["服务条款", "服务条款", "使用和访问 CUAC 服务所适用的规则。"],
    },
    cookie_notice: {
      en: ["Cookies", "Cookie Notice", "The essential browser storage CUAC uses and the controls available to you."],
      "zh-CN": ["Cookie", "Cookie 说明", "CUAC 使用的必要浏览器存储以及你可以使用的控制方式。"],
    },
    admissions_data_policy: {
      en: ["Admissions data", "Admissions Data and Source Policy", "How university, program, intake and scholarship information is sourced, reviewed, corrected and retired."],
      "zh-CN": ["招生数据", "招生数据与来源政策", "高校、项目、入学批次和奖学金信息如何采集、审核、更正和下线。"],
    },
  };

  document.documentElement.lang = locale;
  const copy = pageCopy[key]?.[locale];
  if (copy) {
    setText(".legal-kicker", copy[0]);
    setText("[data-legal-title]", copy[1]);
    setText(".legal-heading > p", copy[2]);
    document.title = `CUAC | ${copy[1]}`;
    const topNote = document.querySelector(".top-note");
    if (topNote) topNote.textContent = locale === "zh-CN" ? "CUAC 政策：经审核、版本化并正式发布" : "CUAC policies: reviewed, versioned and published";
  }
  if (localeSelect) {
    localeSelect.value = locale;
    localeSelect.addEventListener("change", () => {
      const next = new URL(window.location.href);
      next.searchParams.set("lang", localeSelect.value);
      window.location.assign(next);
    });
  }

  function setText(selector, value) {
    const element = root.querySelector(selector);
    if (element) element.textContent = value;
  }

  function showUnavailable() {
    if (status) {
      status.hidden = false;
      status.querySelector("strong").textContent = locale === "zh-CN" ? "该政策尚未正式发布" : "This policy has not been published";
      status.querySelector("p").textContent = locale === "zh-CN"
        ? "CUAC 不会用草稿或占位文案替代经审核的正式政策。该页面发布前，生产上线检查将保持阻断。"
        : "CUAC does not substitute draft or placeholder wording for an approved policy. Production release remains blocked until this page has a reviewed publication.";
    }
    if (sections) sections.replaceChildren();
  }

  async function load() {
    try {
      const response = await fetch(`/api/v1/notices/${encodeURIComponent(key)}/${encodeURIComponent(locale)}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Policy request failed");
      const payload = await response.json();
      const publication = payload && payload.data;
      if (!publication || !publication.document || !Array.isArray(publication.document.sections)) return showUnavailable();

      const documentValue = publication.document;
      setText("[data-legal-title]", documentValue.title);
      setText("[data-legal-version]", `${locale === "zh-CN" ? "版本" : "Version"} ${publication.version}`);
      setText("[data-legal-effective]", `${locale === "zh-CN" ? "生效日期" : "Effective"}: ${new Date(publication.effectiveFrom).toLocaleDateString(locale)}`);
      setText("[data-legal-review]", `${locale === "zh-CN" ? "复核期限" : "Review due"}: ${new Date(publication.reviewDueAt).toLocaleDateString(locale)}`);
      if (status) status.hidden = true;
      if (!sections) return;
      sections.replaceChildren(...documentValue.sections.map((item) => {
        const article = document.createElement("article");
        article.className = "legal-section";
        const heading = document.createElement("h2");
        heading.textContent = item.heading;
        article.append(heading);
        for (const paragraphText of String(item.body).split(/\n{2,}/)) {
          const paragraph = document.createElement("p");
          paragraph.textContent = paragraphText;
          article.append(paragraph);
        }
        return article;
      }));
    } catch {
      showUnavailable();
    }
  }

  void load();
}());
