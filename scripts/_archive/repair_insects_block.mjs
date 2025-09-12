import fs from 'fs/promises';
import path from 'path';

const FILE = path.join(process.cwd(), 'public', 'insects.csv');

const block = [
  // 5613
  'species-5613,Noctuidae,ヤガ科,Eustrotiinae,スジコヤガ亜科,,,Maliattha,,separata,,Walker,1863,ハスオビコヤガ,,,,"Maliattha separata Walker, 1863",,,',
  // 5614
  'species-5614,Noctuidae,ヤガ科,Eustrotiinae,スジコヤガ亜科,,,Maliattha,,arefacta,,(Butler),1879,ヒメオビコヤガ,,,,"Maliattha arefacta (Butler, 1879)",,,',
  // 5615 (already OK typically) keep original if present, so we won't replace 5615
  // 5616
  'species-5616,Noctuidae,ヤガ科,Eustrotiinae,スジコヤガ亜科,,,Maliattha,,rosacea,,(Leech),[1889],ベニモンコヤガ,,,,"Maliattha rosacea (Leech, [1889])",,,',
  // 5617
  'species-5617,Noctuidae,ヤガ科,Eustrotiinae,スジコヤガ亜科,,,Maliattha,,chalcogramma,,(Bryk),1948,ネジロコヤガ,,,,"Maliattha chalcogramma (Bryk, 1948)",,,'
].join('\r\n');

const run = async () => {
  let text = await fs.readFile(FILE, 'utf8');
  // Normalize newlines to CRLF-like for consistent replacement
  text = text.replace(/\r?\n/g, '\r\n');
  // Replace any corrupted block from species-5613 up to just before species-5619 with the corrected lines
  const pattern = /(\r\n)species-5613[\s\S]*?(?=\r\nspecies-5619,)/;
  if (!pattern.test(text)) {
    console.error('Expected block not found; aborting to avoid damaging file.');
    process.exit(2);
  }
  text = text.replace(pattern, `\n${block}\r\n`);
  await fs.writeFile(FILE, text, 'utf8');
  console.log('Repaired block for species-5613..5617 in public/insects.csv');
};

run().catch((e) => { console.error(e); process.exit(1); });

