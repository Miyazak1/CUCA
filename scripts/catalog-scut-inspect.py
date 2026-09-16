import json, re, sys
from html import unescape
from html.parser import HTMLParser
from pathlib import Path

ROOT=Path("work/catalog-official/scut-complete-batch-01")
sys.stdout.reconfigure(encoding="utf-8")
manifest=json.loads((ROOT/"manifest.json").read_text(encoding="utf-8"))

class Parser(HTMLParser):
    def __init__(self):
        super().__init__(); self.in_article=0; self.in_table=0; self.in_cell=0; self.cell=[]; self.row=[]; self.rows=[]; self.text=[]; self.links=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag=="div" and "wp_articlecontent" in attrs.get("class",""): self.in_article+=1
        if self.in_article:
            if tag=="a" and attrs.get("href"): self.links.append({"href":attrs["href"],"label":""})
            if tag=="table": self.in_table+=1
            elif tag=="tr" and self.in_table: self.row=[]
            elif tag in ("td","th") and self.in_table: self.in_cell+=1; self.cell=[]
    def handle_endtag(self,tag):
        if self.in_article:
            if tag in ("td","th") and self.in_cell: self.row.append(" ".join(" ".join(self.cell).split())); self.in_cell-=1
            elif tag=="tr" and self.in_table and any(self.row): self.rows.append(self.row)
            elif tag=="table" and self.in_table: self.in_table-=1
            elif tag=="div": self.in_article=max(0,self.in_article-1)
    def handle_data(self,data):
        if self.in_article:
            clean=" ".join(unescape(data).split())
            if clean:
                self.text.append(clean)
                if self.links and not self.links[-1]["label"]: self.links[-1]["label"]=clean
                if self.in_cell: self.cell.append(clean)

selected=set(sys.argv[1:])
for src in manifest["sources"]:
    if selected and src["id"] not in selected: continue
    p=Parser(); p.feed((ROOT/src["artifactPath"]).read_text(encoding="utf-8",errors="replace"))
    print(json.dumps({"id":src["id"],"sourceUrl":src["finalUrl"],"sourceSha256":src["sha256"],"rows":p.rows,"links":p.links,"article":" | ".join(p.text)},ensure_ascii=False,indent=2))
