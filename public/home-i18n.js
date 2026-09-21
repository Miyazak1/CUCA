(function renderLocalizedHome() {
  "use strict";
  const i18n = window.CUACI18n;
  if (!i18n || i18n.locale === "en") return;
  const t = i18n.t;
  document.title = `CUAC | ${t("home.title")}`;
  const main = document.querySelector("main");
  if (!main) return;
  const category = (href, title, body) => `<a class="cat" href="${href}" hreflang="en"><strong>${t(title)}</strong><span>${t(body)}</span></a>`;
  const step = (number, title, body) => `<article class="step-card"><span class="step-number">${number}</span><strong>${t(title)}</strong><p>${t(body)}</p></article>`;
  main.innerHTML = `
    <section class="hero reveal visible" aria-labelledby="localized-home-title"><div class="hero-copy">
      <div class="kicker"><span class="dot"></span>${t("home.kicker")}</div>
      <h1 id="localized-home-title">${t("home.title")}</h1><p class="sub">${t("home.sub")}</p>
      <form class="planner" data-site-search-form><textarea data-site-search-input aria-label="${t("shell.search")}" rows="2" placeholder="${t("home.placeholder")}"></textarea>
        <button type="submit" aria-label="${t("home.search")}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg></button></form>
      <div class="chips" aria-label="${t("home.catalogTitle")}">
        <button type="button" data-search-chip="undergraduate">${t("home.chip.undergraduate")}</button><button type="button" data-search-chip="master">${t("home.chip.master")}</button>
        <button type="button" data-search-chip="English taught">${t("home.chip.english")}</button><button type="button" data-search-chip="scholarship">${t("home.chip.scholarship")}</button><button type="button" data-search-chip="Fall 2026">${t("home.chip.fall")}</button>
      </div><div class="planner-feedback" data-planner-feedback aria-live="polite"></div>
    </div></section>
    <section class="section reveal visible"><div class="section-head"><div><h2>${t("home.catalogTitle")}</h2><p>${t("home.destinationNotice")}</p></div></div>
      <div class="categories localized-categories">${category("programs.html", "home.cat.programs", "home.cat.programsBody")}${category("universities.html", "home.cat.universities", "home.cat.universitiesBody")}${category("scholarships.html", "home.cat.scholarships", "home.cat.scholarshipsBody")}${category("cities.html", "home.cat.cities", "home.cat.citiesBody")}</div></section>
    <section class="section reveal visible"><div class="section-head"><div><h2>${t("home.planTitle")}</h2><p>${t("home.planBody")}</p></div></div>
      <div class="steps">${step("01", "home.step.1", "home.step.1Body")}${step("02", "home.step.2", "home.step.2Body")}${step("03", "home.step.3", "home.step.3Body")}${step("04", "home.step.4", "home.step.4Body")}</div></section>
    <section class="section reveal visible"><div class="fit-band localized-boundary"><div class="fit-band-copy"><h2>${t("home.boundaryTitle")}</h2><p>${t("home.boundaryBody")}</p></div></div></section>
    <section class="account-strip reveal visible" id="cuac-hub"><div class="account-strip-inner"><div><h2>${t("home.accountTitle")}</h2><p>${t("home.accountBody")}</p></div>
      <button class="primary" type="button" data-create-list>${t("home.create")}</button></div></section>
    <div data-cuac-footer></div>`;
}());
