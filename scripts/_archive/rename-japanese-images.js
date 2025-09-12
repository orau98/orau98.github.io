import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ファイル名から学名を抽出してリネーム
function renameImages() {
  const imagesDir = path.join(__dirname, '../public/images/insects');
  
  const renameMappings = [
    {
      current: 'クロモクメヨトウ Dypterygia caliginosa (Walker, 1858).jpg',
      new: 'Dypterygia_caliginosa.jpg'
    },
    {
      current: 'コスジシロエダシャク Cabera purus (Butler, 1878).jpg',
      new: 'Cabera_purus.jpg'
    },
    {
      current: 'シマフコヤガ Corgatha nitens (Butler, 1879).jpg',
      new: 'Corgatha_nitens.jpg'
    },
    {
      current: 'シロテンツマキリアツバ Amphitrogia amphidecta (Butler, 1879).jpg',
      new: 'Amphitrogia_amphidecta.jpg'
    },
    {
      current: 'スジモンヒトリ本土・対馬・屋久島亜種 Spilarctia seriatopunctata seriatopunctata (Motschulsky, [1861]).jpg',
      new: 'Spilarctia_seriatopunctata.jpg'
    },
    {
      current: 'プライヤエグリシャチホコ Lophontosia pryeri (Butler, 1879).jpg',
      new: 'Lophontosia_pryeri.jpg'
    }
  ];
  
  renameMappings.forEach(mapping => {
    const oldPath = path.join(imagesDir, mapping.current);
    const newPath = path.join(imagesDir, mapping.new);
    
    if (fs.existsSync(oldPath)) {
      // 新しい名前のファイルが既に存在しない場合のみリネーム
      if (!fs.existsSync(newPath)) {
        fs.renameSync(oldPath, newPath);
        console.log(`✓ Renamed: ${mapping.current} → ${mapping.new}`);
      } else {
        console.log(`⚠ Already exists: ${mapping.new}`);
      }
    } else {
      console.log(`✗ File not found: ${mapping.current}`);
    }
  });
  
  console.log('\nRename operation completed!');
}

// 実行
renameImages();