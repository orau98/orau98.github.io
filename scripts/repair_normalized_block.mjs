import fs from 'fs/promises';
import path from 'path';

const FILE = path.join(process.cwd(), 'normalized_data', 'insects.csv');

const block = [
  'species-5613,Noctuidae,ヤガ科,Eustrotiinae,スジコヤガ亜科,,,Maliattha,,separata,,Walker,1863,ハスオビコヤガ,,,,"Maliattha separata Walker, 1863",,,',
  'species-5614,Noctuidae,ヤガ科,Eustrotiinae,スジコヤガ亜科,,,Maliattha,,arefacta,,(Butler),1879,ヒメオビコヤガ,,,,"Maliattha arefacta (Butler, 1879)",,,',
  'species-5615,Noctuidae,ヤガ科,Eustrotiinae,スジコヤガ亜科,,,Maliattha,,signifera,,(Walker),1858,ヒメネジロコヤガ,,,,"Maliattha signifera (Walker, 1858)",,,',
  'species-5616,Noctuidae,ヤガ科,Eustrotiinae,スジコヤガ亜科,,,Maliattha,,rosacea,,(Leech),[1889],ベニモンコヤガ,,,,"Maliattha rosacea (Leech, [1889])",,,',
  'species-5617,Noctuidae,ヤガ科,Eustrotiinae,スジコヤガ亜科,,,Maliattha,,chalcogramma,,(Bryk),1948,ネジロコヤガ,,,,"Maliattha chalcogramma (Bryk, 1948)",,,',
  'species-5618,Noctuidae,ヤガ科,Eustrotiinae,スジコヤガ亜科,,,Maliattha,,bella,,(Staudinger),1888,ソトムラサキコヤガ,,,,"Maliattha bella (Staudinger, 1888)",,,'
].join('\n');

const run = async () => {
  let text = await fs.readFile(FILE, 'utf8');
  // Replace from species-5613 up to before species-5619
  const pattern = /(\n)species-5613[\s\S]*?(?=\nspecies-5619,)/;
  if (!pattern.test(text)) {
    console.error('Expected block not found in normalized_data/insects.csv');
    process.exit(2);
  }
  text = text.replace(pattern, `\n${block}\n`);
  await fs.writeFile(FILE, text, 'utf8');
  console.log('Repaired block for species-5613..5618 in normalized_data/insects.csv');
};

run().catch((e) => { console.error(e); process.exit(1); });

