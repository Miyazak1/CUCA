export const CATALOG_FACT_PATTERN=/https?:\/\/[^\s<>]+|\p{Sc}|\b(?:IELTS|TOEFL|TOEIC|HSKK?|CSCA|CSC|GPA|CGPA|CNY|RMB|USD|SAT|ACT|PTE|JLPT|TOPIK|DELF|DALF|DELE|TORFL|CEFR)(?=\b|\d)|(?<![\p{N}])\d[\d.,]*(?:[-–]\d[\d.,]*)?%?/gu;
export const isCatalogDisplayText=value=>typeof value==='string'&&/\p{L}/u.test(value);
export const catalogFacts=text=>[...text.matchAll(CATALOG_FACT_PATTERN)].map(m=>/^\d/.test(m[0])?m[0].replace(/[.,]+$/,''):m[0]);
export function missingCatalogFacts(source,translation){
 const available=catalogFacts(translation),missing=[];
 for(const fact of catalogFacts(source)){const index=available.indexOf(fact);if(index<0)missing.push(fact);else available.splice(index,1);}
 return missing;
}
