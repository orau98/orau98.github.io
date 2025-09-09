import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

// Generate safe alias suggestions using the Markdown table (with 和名) as supervision
// Criteria:
// - Same genus
// - Levenshtein distance <= 2 for species epithet
// - Japanese name in candidate's JA set contains the source JA, or exactly matches
// - Unique candidate (no ties at minimal distance)
// Outputs: reports/alias_suggestions_safe.csv (source,target,insect_id,distance,ja)

const mdPath = process.argv[2] || path.join('tmp', 'standard1_notes.md');
const insectsPath = path.join('public', 'insects.csv');
const outPath = path.join('reports', 'alias_suggestions_safe.csv');

function stripDiacritics(s='') { try { return s.normalize('NFKD').replace(/\p{Diacritic}/gu, ''); } catch { return s; } }
function collapseSubgenus(sci='') { const m=sci.match(/^([A-Z][a-z-]+)\s*\([^)]*\)\s*([a-z-]+)(.*)$/); return m?`${m[1]} ${m[2]}${m[3]||''}`:sci; }
function toBinomial(sci='') {
  let cleaned = String(sci).replace(/[\*_`]/g, '').replace(/\s+/g, ' ').trim();
  cleaned = stripDiacritics(cleaned);
  cleaned = collapseSubgenus(cleaned);
  const t = cleaned.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const parts = t.split(/\s+/);
  if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
  return parts[0] || '';
}
function levenshtein(a,b){a=a.toLowerCase();b=b.toLowerCase();const m=a.length,n=b.length;const dp=Array.from({length:m+1},()=>Array(n+1).fill(0));for(let i=0;i<=m;i++)dp[i][0]=i;for(let j=0;j<=n;j++)dp[0][j]=j;for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return dp[m][n];}

// Parse markdown table rows with 和名/学名
function parseMarkdown(md){
  const lines = md.split(/\r?\n/).filter(l=>l.trim().startsWith('|'));
  if (lines.length<2) return [];
  const headers = lines[0].split('|').map(c=>c.trim().replace(/[\*_`]/g,'').trim());
  const idxJa=headers.findIndex(h=>h.includes('和名'));
  const idxSci=headers.findIndex(h=>h.includes('学名'));
  const rows=[];
  for(const l of lines.slice(2)){
    const cells=l.split('|').map(c=>c.trim());
    const ja=idxJa!==-1?(cells[idxJa]||''):'';
    const sci=idxSci!==-1?(cells[idxSci]||''):'';
    if (!sci) continue;
    rows.push({ja,sci});
  }
  return rows;
}

// Load insects and build genus map with JA sets
function loadInsects(p){
  const text=fs.readFileSync(p,'utf8');
  const parsed=Papa.parse(text,{header:true,skipEmptyLines:true,transformHeader:h=>h.trim(),transform:v=>(v??'').toString().trim()});
  const genusMap=new Map();
  parsed.data.forEach(r=>{
    const id=r.insect_id; if(!id) return;
    const bin=toBinomial(r.scientific_name || `${r.genus||''} ${r.species||''}`);
    const g=bin.split(' ')[0]; if(!g) return;
    const names=new Set();
    const add=(s)=>{ if(!s) return; let t=String(s).replace(/（[^）]*）/g,'').replace(/\([^\)]*\)/g,'').trim(); if(t) names.add(t); };
    add(r.japanese_name); add(r.old_japanese_name);
    (r.alternative_name||'').split(/[;、，,]/).forEach(add);
    (r.other_names||'').split(/[;、，,]/).forEach(add);
    if(!genusMap.has(g)) genusMap.set(g,[]);
    genusMap.get(g).push({id,bin,jaSet:names});
  });
  return genusMap;
}

function main(){
  if(!fs.existsSync(mdPath)) { console.error('MD not found:', mdPath); process.exit(2);} 
  const md=fs.readFileSync(mdPath,'utf8');
  const rows=parseMarkdown(md);
  const genusMap=loadInsects(insectsPath);
  const out=[]; const seen=new Set();
  for(const r of rows){
    const bin=toBinomial(r.sci); if(!bin.includes(' ')) continue;
    const [g,s]=bin.split(' ');
    const cands=genusMap.get(g)||[];
    let best=null; let tie=false;
    for(const c of cands){
      const s2=c.bin.split(' ')[1]||'';
      const d=levenshtein(s,s2);
      if(d<=2){ if(!best||d<best.distance){ best={...c,distance:d}; tie=false; } else if(d===best.distance){ tie=true; } }
    }
    if(best && !tie && best.distance > 0){
      // require JA hint to be consistent
      if(r.ja){
        let ok=false; const ja=String(r.ja).trim();
        if (best.jaSet.has(ja)) ok=true;
        else { // contains relation (some sources add語尾/別名)
          for(const j of best.jaSet){ if(j && (j.includes(ja) || ja.includes(j))) { ok=true; break; } }
        }
        if(!ok) continue;
      }
      const key=`${bin}=>${best.bin}`; if(seen.has(key)) continue; seen.add(key);
      out.push({ source: bin, target: best.bin, insect_id: best.id, distance: best.distance, ja: r.ja||'' });
    }
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const csv=Papa.unparse(out);
  fs.writeFileSync(outPath, csv, 'utf8');
  console.log(`Safe alias suggestions: ${out.length} -> ${outPath}`);
}

main();
