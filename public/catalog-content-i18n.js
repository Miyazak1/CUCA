(function installCatalogContent(global) {
  "use strict";
  const locale = global.CUACI18n?.locale || "en";
  // The build version includes the translation manifest dependency, so a
  // dictionary-only release also invalidates intermediate manifest caches.
  const manifestVersion = new URL(document.currentScript?.src || location.href).searchParams.get("v") || "unversioned";
  const enabled = ["vi", "th", "id", "ms", "ar"].includes(locale);
  const normalize = value => String(value ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
  const dictionary = new Map();
  const foldedDictionary = new Map();
  const candidates = new Map();
  const missing = new Set();
  const phraseCache = new Map();
  let orderedCandidates = [];
  let candidatesChanged = false;
  // Exact display-only repairs verified visually against the registered AHU
  // program PDF, SHA-256 95397e8a...c7ae6b98, page 2, printed major row 79.
  // This does not alter source records, admissions rules, or program IDs.
  const sourceCorrections = new Map([
    ["(cid:36)(cid:85)(cid:87)(cid:76)(cid:191)(cid:70)(cid:76)(cid:68)(cid:79)(cid:3)(cid:44)(cid:81)(cid:87)(cid:72)(cid:79)(cid:79)(cid:76)(cid:74)(cid:72)(cid:81)(cid:70)(cid:72)","Artificial Intelligence"],
    ["(cid:36)(cid:85)(cid:87)(cid:76)(cid:191)(cid:70)(cid:76)(cid:68)(cid:79)(cid:3) Intelligence","Artificial Intelligence"]
  ]);
  const labelRows = [
    ["数学","Mathematics","Toán học","คณิตศาสตร์","Matematika","Matematik","الرياضيات"],
    ["物理","Physics","Vật lý","ฟิสิกส์","Fisika","Fizik","الفيزياء"],
    ["化学","Chemistry","Hóa học","เคมี","Kimia","Kimia","الكيمياء"],
    ["中文(文科)","Chinese (for Humanities Disciplines)","Tiếng Trung (khối ngành xã hội)","ภาษาจีน (สายมนุษยศาสตร์)","Bahasa Mandarin (Humaniora)","Bahasa Cina (Kemanusiaan)","الصينية (للتخصصات الإنسانية)"],
    ["中文(理科)","Chinese (for Science Disciplines)","Tiếng Trung (khối ngành khoa học)","ภาษาจีน (สายวิทยาศาสตร์)","Bahasa Mandarin (Sains)","Bahasa Cina (Sains)","الصينية (للتخصصات العلمية)"],
    ["public","Public","Công lập","รัฐ","Negeri","Awam","حكومية"],
    ["private","Private","Tư thục","เอกชน","Swasta","Swasta","خاصة"],
    ["regular","Regular","Chính quy","ทั่วไป","Umum","Umum","عادية"],
    ["full","Full","Toàn phần","เต็มจำนวน","Penuh","Penuh","كامل"],
    ["partial","Partial","Một phần","บางส่วน","Sebagian","Separa","جزئي"],
    ["coastal-city","Coastal city","Thành phố ven biển","เมืองชายฝั่ง","Kota pesisir","Bandar pesisir","مدينة ساحلية"],
    ["higher-education-centre","Higher education centre","Trung tâm giáo dục đại học","ศูนย์กลางอุดมศึกษา","Pusat pendidikan tinggi","Pusat pendidikan tinggi","مركز للتعليم العالي"],
    ["municipality","Municipality","Thành phố trực thuộc trung ương","นครปกครองโดยตรง","Kota setingkat provinsi","Bandar bertaraf wilayah","بلدية مركزية"],
    ["large-city","Large city","Thành phố lớn","เมืองใหญ่","Kota besar","Bandar besar","مدينة كبيرة"],
    ["extensive-public-transport","Extensive public transport","Giao thông công cộng rộng khắp","ระบบขนส่งสาธารณะครอบคลุม","Transportasi umum luas","Pengangkutan awam meluas","نقل عام واسع التغطية"],
    ["provincial-capital","Provincial capital","Thủ phủ tỉnh","เมืองหลวงมณฑล","Ibu kota provinsi","Ibu negeri wilayah","عاصمة المقاطعة"],
    ["large-student-population","Large student population","Đông sinh viên","มีนักศึกษาจำนวนมาก","Populasi mahasiswa besar","Populasi pelajar besar","عدد كبير من الطلاب"],
    ["metro-network","Metro network","Mạng lưới tàu điện ngầm","เครือข่ายรถไฟใต้ดิน","Jaringan metro","Rangkaian metro","شبكة مترو"],
    ["digital-economy-centre","Digital economy centre","Trung tâm kinh tế số","ศูนย์กลางเศรษฐกิจดิจิทัล","Pusat ekonomi digital","Pusat ekonomi digital","مركز للاقتصاد الرقمي"],
    ["metro-city","Metro city","Thành phố có tàu điện ngầm","เมืองที่มีรถไฟใต้ดิน","Kota dengan metro","Bandar dengan metro","مدينة بها مترو"],
    ["western-china-centre","Western China centre","Trung tâm miền Tây Trung Quốc","ศูนย์กลางภาคตะวันตกของจีน","Pusat Tiongkok barat","Pusat China barat","مركز غربي الصين"],
    ["special-economic-zone","Special economic zone","Đặc khu kinh tế","เขตเศรษฐกิจพิเศษ","Zona ekonomi khusus","Zon ekonomi khas","منطقة اقتصادية خاصة"],
    ["university-city","University city","Thành phố đại học","เมืองมหาวิทยาลัย","Kota universitas","Bandar universiti","مدينة جامعية"],
    ["port-city","Port city","Thành phố cảng","เมืองท่า","Kota pelabuhan","Bandar pelabuhan","مدينة ساحلية ذات ميناء"],
    ["greater-bay-area","Greater Bay Area","Vùng Vịnh Lớn","เขตอ่าวกวางตุ้ง-ฮ่องกง-มาเก๊า","Greater Bay Area","Greater Bay Area","منطقة الخليج الكبرى"],
    ["science-centre","Science centre","Trung tâm khoa học","ศูนย์กลางวิทยาศาสตร์","Pusat sains","Pusat sains","مركز علمي"],
    ["yangtze-river-delta","Yangtze River Delta","Đồng bằng sông Dương Tử","สามเหลี่ยมปากแม่น้ำแยงซี","Delta Sungai Yangtze","Delta Sungai Yangtze","دلتا نهر اليانغتسي"],
    ["school-evidence-draft","University evidence pending","Bằng chứng về trường đang chờ xác minh","หลักฐานมหาวิทยาลัยรอตรวจสอบ","Bukti universitas menunggu verifikasi","Bukti universiti menunggu pengesahan","أدلة الجامعات بانتظار التحقق"],
    ["municipal-statistics-draft","City statistics pending verification","Thống kê thành phố đang chờ xác minh","สถิติเมืองรอตรวจสอบ","Statistik kota menunggu verifikasi","Statistik bandar menunggu pengesahan","إحصاءات المدينة بانتظار التحقق"]
  ];
  const labelIndex=["en","vi","th","id","ms","ar"].indexOf(locale)+1;
  const labels=new Map();for(const row of labelRows){labels.set(row[0],row[labelIndex]||row[1]);labels.set(row[0].replaceAll("-"," "),row[labelIndex]||row[1]);labels.set(row[1].toLowerCase(),row[labelIndex]||row[1]);}
  for(const [source,corrected]of sourceCorrections)candidates.set(source,corrected);
  candidatesChanged=true;
  const messages = {
    vi: ["Thông tin tuyển sinh được dịch để tham khảo. Hãy xác nhận yêu cầu tại nguồn chính thức của trường.", "Xem bản gốc tiếng Anh", "Bản dịch tạm thời không khả dụng. Nội dung gốc tiếng Anh được hiển thị.", "Một số nội dung mới chưa có bản dịch; nội dung gốc được giữ lại."],
    th: ["ข้อมูลการรับสมัครฉบับแปลใช้เพื่ออ้างอิง โปรดยืนยันข้อกำหนดจากแหล่งข้อมูลทางการของมหาวิทยาลัย", "ดูต้นฉบับภาษาอังกฤษ", "คำแปลไม่พร้อมใช้งานชั่วคราว กำลังแสดงเนื้อหาต้นฉบับภาษาอังกฤษ", "เนื้อหาใหม่บางส่วนยังไม่มีคำแปล จึงคงต้นฉบับไว้"],
    id: ["Informasi penerimaan diterjemahkan sebagai referensi. Konfirmasikan persyaratan melalui sumber resmi universitas.", "Lihat versi asli bahasa Inggris", "Terjemahan sementara tidak tersedia. Konten asli bahasa Inggris ditampilkan.", "Sebagian konten baru belum diterjemahkan; teks aslinya dipertahankan."],
    ms: ["Maklumat kemasukan diterjemahkan sebagai rujukan. Sahkan syarat melalui sumber rasmi universiti.", "Lihat versi asal bahasa Inggeris", "Terjemahan tidak tersedia buat sementara waktu. Kandungan asal bahasa Inggeris dipaparkan.", "Sesetengah kandungan baharu belum diterjemahkan; teks asal dikekalkan."],
    ar: ["تُعرض معلومات القبول المترجمة للاستئناس. تأكد من المتطلبات لدى المصدر الرسمي للجامعة.", "عرض الأصل بالإنجليزية", "الترجمة غير متاحة مؤقتًا. يُعرض المحتوى الأصلي بالإنجليزية.", "لم تُترجم بعض المعلومات الجديدة بعد؛ يُحتفظ بالنص الأصلي."]
  };
  let state = enabled ? "loading" : "original";
  let queued = false;
  const pendingMessages={vi:"Bản dịch ngôn ngữ này đang được chuẩn bị. Hiện hiển thị nội dung gốc tiếng Anh.",th:"คำแปลภาษานี้กำลังจัดเตรียม ขณะนี้แสดงต้นฉบับภาษาอังกฤษ",id:"Terjemahan bahasa ini sedang disiapkan. Konten asli bahasa Inggris ditampilkan.",ms:"Terjemahan bahasa ini sedang disediakan. Kandungan asal bahasa Inggeris dipaparkan.",ar:"يجري إعداد ترجمة هذه اللغة. يُعرض حاليًا المحتوى الأصلي بالإنجليزية."};

  function text(value) {
    const original = sourceCorrections.get(normalize(value)) || String(value ?? "");
    const label=labels.get(normalize(original).toLowerCase());if(label)return label;
    if (!enabled) return original;
    return dictionary.get(normalize(original)) || foldedDictionary.get(normalize(original).toLowerCase()) || original;
  }
  function phrase(value) {
    if(phraseCache.has(value))return phraseCache.get(value);
    let result = text(value);
    if (result !== String(value ?? "")) return result;
    // Compose only fields actually returned for this page. Do not rewrite IDs,
    // filter values, URLs, or the underlying record used by application logic.
    if(candidatesChanged){orderedCandidates=[...candidates].sort((a,b)=>b[0].length-a[0].length).map(([source,translated])=>({source,translated,pattern:new RegExp(`(^|[^\\p{L}\\p{N}])${source.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}(?=$|[^\\p{L}\\p{N}])`,"gu")}));candidatesChanged=false;}
    for (const {source, translated, pattern} of orderedCandidates) {
      if (source.length < 3 || source === translated || !result.includes(source)) continue;
      result = result.replace(pattern,(_match,prefix)=>prefix+translated);
    }
    if(phraseCache.size>5000)phraseCache.clear();phraseCache.set(value,result);
    return result;
  }
  const displayFields = new Set(["nameEn","nameZh","title","fieldCategory","subjectArea","teachingLanguage","cscaSubjects","cscaRequirement","hskRequirement","englishRequirement","tuitionText","deadlineLabel","applicationRound","applicationNote","scholarshipText","badgeText","displayGroupLabel","schoolType","region","province","regionLabel","ranking","applicationLevel","languageOfInstruction","languageRequirement","deadlineSummary","tuitionSummary","applicationFee","subjectTags","languageTags","tuitionBandLabel","campusHighlights","typeLabel","fundingLevel","coverage","amountText","summary","requirementText","applicableDegree","applicableProgram","bodySections","benefitItems","benefits","eligibilityItems","applicationMaterials","applicationSteps","tags","targetCountries","targetRegions","providerNameEn","providerLocation","content","ruleText","appliesTo","category","level","stage","evidenceType"]);
  displayFields.delete("nameZh"); // Official Chinese names remain source references.
  displayFields.add("providerName");
  displayFields.add("cityZh");
  displayFields.add("programNameEn");
  displayFields.add("intakeTerm");
  function collect(value) {
    if (Array.isArray(value)) { value.forEach(collect); return; }
    if (value && typeof value === "object") {
      Object.entries(value).filter(([key])=>!["key","id","url","sourceUrl","capturedAt","schemaVersion"].includes(key)).forEach(([,item])=>collect(item));
      return;
    }
    if (typeof value !== "string" || !/[\p{L}]/u.test(value)) return;
    const source = normalize(value);
    if(source.includes(" · ")){source.split(" · ").forEach(collect);return;}
    let translated = labels.get(source.toLowerCase()) || dictionary.get(source) || foldedDictionary.get(source.toLowerCase());
    if(!translated){
      const titled=source.replace(/[_-]+/g," ").replace(/\b[a-z]/g,c=>c.toUpperCase());
      for(const ui of [global.CUACCatalogDetailI18n,global.CUACCatalogI18n,global.CUACCitiesI18n]){
        if(!ui?.ui)continue;
        const candidate=ui.ui(titled);if(candidate!==source&&candidate!==titled){translated=candidate;break;}
      }
    }
    if (translated) {if(!candidates.has(source)){candidates.set(source, translated);candidatesChanged=true;phraseCache.clear();}} else missing.add(source);
  }
  function track(records) {
    if (!enabled || state !== "ready") return;
    (Array.isArray(records) ? records : [records]).forEach(record => {
      if (!record || typeof record !== "object") return;
      for (const [key,value] of Object.entries(record)) {
        if (key === "city" && typeof value === "string") collect(value);
        else if (displayFields.has(key)) collect(value);
        else if (["school","program","city","document","requirements","upcomingDeadlines"].includes(key)) track(value);
      }
    });
  }
  function notice() {
    if (!enabled) return;
    const main = document.querySelector("main"); if (!main) return;
    const host = main.querySelector(".catalog-detail-shell,.shell") || main.querySelector("section,header") || main;
    let note = host.querySelector("[data-catalog-translation-notice]");
    if (!note) {
      note = host.querySelector(".catalog-language-note,.search-language-note") || document.createElement("p");
      note.replaceChildren();note.classList.add("catalog-translation-notice");
      note.dataset.catalogTranslationNotice = "true"; note.dataset.catalogOriginal = "true";
      const copy = document.createElement("span"), link = document.createElement("a");
      const url = new URL(location.href); url.searchParams.set("lang", "en");
      link.href = url.pathname + url.search + url.hash; link.hreflang = "en"; link.textContent = messages[locale][1];
      note.append(copy, document.createTextNode(" "), link);if(!note.parentElement)host.prepend(note);
    }
    const copy = state === "pending" ? pendingMessages[locale] : state === "unavailable" ? messages[locale][2] : missing.size ? messages[locale][3] : messages[locale][0];
    if(note.firstChild.textContent!==copy)note.firstChild.textContent=copy;
    note.dataset.translationState = state;
  }
  function apply(root = document.querySelector("main")) {
    if (!root || state === "loading") return;
    if (state !== "loading") {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = []; while(walker.nextNode()) nodes.push(walker.currentNode);
      for (const node of nodes) {
        const parent = node.parentElement;
        if (!parent || parent.closest("[data-catalog-original],.catalog-source-link,.footer,script,style,code,textarea,input")) continue;
        const source = node.nodeValue, translated = phrase(source.trim());
        if (translated && translated !== source.trim()) {
          node.nodeValue = source.replace(source.trim(), translated);
          parent.dataset.catalogContentTranslated = locale;
          if (parent.getAttribute("lang") === "en") parent.lang = locale;
        }
      }
      root.querySelectorAll("[aria-label],[title],img[alt]").forEach(node => {
        if (node.closest("[data-catalog-original],.footer")) return;
        for (const attr of ["aria-label","title","alt"]) {
          const value=node.getAttribute(attr); if(value){const translated=phrase(value);if(value!==translated)node.setAttribute(attr,translated);}
        }
      });
    }
    notice();
    document.body.dataset.catalogContentLocale = locale;
    document.body.dataset.catalogContentState = state;
  }
  function schedule() { if(queued)return;queued=true;queueMicrotask(()=>{queued=false;apply();}); }
  const ready = enabled ? (async()=>{
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),8000);
    try {
      const coverageResponse=await fetch(`/catalog-content-manifest.json?v=${encodeURIComponent(manifestVersion)}`,{signal:controller.signal,cache:"no-cache"});
      if(!coverageResponse.ok)throw new Error("Translation coverage unavailable");
      const coverage=await coverageResponse.json();
      if(coverage.locales?.[locale]?.ready!==true){state="pending";apply();return state;}
      const response=await fetch(`/catalog-content-${locale}.json?v=${coverage.locales[locale].sha256.slice(0,16)}`,{signal:controller.signal});
      if(!response.ok)throw new Error("Translation asset unavailable");
      const entries=await response.json();
      for(const [source,translated] of Object.entries(entries))if(typeof translated==="string"&&translated){dictionary.set(source,translated);if(!foldedDictionary.has(source.toLowerCase()))foldedDictionary.set(source.toLowerCase(),translated);}
      for(const [source,corrected]of sourceCorrections)candidates.set(source,text(corrected));candidatesChanged=true;
      if(!dictionary.size)throw new Error("Empty translation asset");
      state="ready";
    } catch { state="unavailable"; } finally {clearTimeout(timeout);}
    apply(); return state;
  })() : Promise.resolve("original");
  global.CUACCatalogContent=Object.freeze({locale,ready,text,phrase,track,apply,sourceText:value=>sourceCorrections.get(normalize(value))||String(value??""),get state(){return state;},get missing(){return [...missing];}});
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
}(window));
