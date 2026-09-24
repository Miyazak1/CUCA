import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

type InventoryCity = {
  slug: string;
  nameEn: string;
  nameZh: string;
  province: string | null;
  region: string | null;
};

const root = process.cwd();
const inventoryPath = resolve(root, process.argv[2] || "work/city-data/city-inventory.json");
const outputPath = resolve(root, process.argv[3] || "work/city-data/city-identity-normalization.draft.json");

const provinceBySlug: Record<string, string> = {
  wuhan: "Hubei", chengdu: "Sichuan", tianjin: "Tianjin", xiamen: "Fujian", hefei: "Anhui",
  changchun: "Jilin", jinan: "Shandong", xiangtan: "Hunan", qingdao: "Shandong", kunming: "Yunnan",
  zhengzhou: "Henan", chongqing: "Chongqing", qinhuangdao: "Hebei", lanzhou: "Gansu", shijiazhuang: "Hebei",
  nanning: "Guangxi", guiyang: "Guizhou", anshan: "Liaoning", baoding: "Hebei", benxi: "Liaoning",
  binzhou: "Shandong", changzhou: "Jiangsu", chifeng: "Inner Mongolia", dali: "Yunnan", daqing: "Heilongjiang",
  dongguan: "Guangdong", fushun: "Liaoning", fuxin: "Liaoning", fuzhou: "Fujian", guilin: "Guangxi",
  haikou: "Hainan", huaian: "Jiangsu", huaihua: "Hunan", huangshi: "Hubei", jian: "Jiangxi",
  jiamusi: "Heilongjiang", jiaozuo: "Henan", jiaxing: "Zhejiang", jilin: "Jilin", jinhua: "Zhejiang",
  jinzhou: "Liaoning", kaifeng: "Henan", kunshan: "Jiangsu", langfang: "Hebei", lianyungang: "Jiangsu",
  luoyang: "Henan", luzhou: "Sichuan", mengzi: "Yunnan", mianyang: "Sichuan", mudanjiang: "Heilongjiang",
  nanchang: "Jiangxi", nanchong: "Sichuan", nantong: "Jiangsu", ningbo: "Zhejiang", sanya: "Hainan",
  shantou: "Guangdong", shihezi: "Xinjiang", suzhou: "Jiangsu", taian: "Shandong", taiyuan: "Shanxi",
  weifang: "Shandong", wenzhou: "Zhejiang", wuhu: "Anhui", wuxi: "Jiangsu", xinxiang: "Henan",
  xinyang: "Henan", xuzhou: "Jiangsu", yaan: "Sichuan", yangling: "Shaanxi", yantai: "Shandong",
  yibin: "Sichuan", yinchuan: "Ningxia", yuxi: "Yunnan", zhanjiang: "Guangdong", zhenjiang: "Jiangsu",
  zhoushan: "Zhejiang", zibo: "Shandong",
};

const regionByProvince: Record<string, string> = {
  Beijing: "North China", Tianjin: "North China", Hebei: "North China", Shanxi: "North China", "Inner Mongolia": "North China",
  Liaoning: "Northeast China", Jilin: "Northeast China", Heilongjiang: "Northeast China",
  Shanghai: "East China", Jiangsu: "East China", Zhejiang: "East China", Anhui: "East China", Fujian: "East China", Jiangxi: "East China", Shandong: "East China",
  Henan: "Central China", Hubei: "Central China", Hunan: "Central China",
  Guangdong: "South China", Guangxi: "South China", Hainan: "South China",
  Chongqing: "Southwest China", Sichuan: "Southwest China", Guizhou: "Southwest China", Yunnan: "Southwest China", Tibet: "Southwest China",
  Shaanxi: "Northwest China", Gansu: "Northwest China", Qinghai: "Northwest China", Ningxia: "Northwest China", Xinjiang: "Northwest China",
};

const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const cities = (inventory.cities as InventoryCity[]).map(city => {
  const candidateProvince = city.province || provinceBySlug[city.slug];
  if (!candidateProvince) throw new Error(`No province draft mapping for ${city.slug}.`);
  const candidateRegion = regionByProvince[candidateProvince];
  if (!candidateRegion) throw new Error(`No normalized region for ${city.slug} / ${candidateProvince}.`);
  return {
    slug: city.slug,
    nameEn: city.nameEn,
    nameZh: city.nameZh,
    currentProvince: city.province,
    candidateProvince,
    currentRegion: city.region,
    candidateRegion,
    changeRequired: city.province !== candidateProvince || city.region !== candidateRegion,
    evidenceState: city.province ? "existing_catalog_value" : "controlled_taxonomy_draft",
    reviewState: "pending",
    publicationAuthorized: false,
  };
});

const result = {
  version: 1,
  generatedAt: new Date().toISOString(),
  status: "unreviewed_draft",
  publicationAuthorized: false,
  taxonomy: "CUAC seven-region city normalization v1",
  note: "This closes the internal identity-data gap for planning. Missing province values and normalized regions still require official evidence before publication.",
  summary: {
    cityCount: cities.length,
    identityDraftComplete: cities.filter(city => city.candidateProvince && city.candidateRegion).length,
    provinceValuesAdded: cities.filter(city => !city.currentProvince).length,
    normalizationChanges: cities.filter(city => city.changeRequired).length,
  },
  cities,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: result.summary }, null, 2));
