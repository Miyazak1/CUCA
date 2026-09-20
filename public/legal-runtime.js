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

  document.documentElement.lang = locale;
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
