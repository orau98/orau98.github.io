import React, { useState, useEffect } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Papa from 'papaparse';
import InsectsHostPlantExplorer from './InsectsHostPlantExplorer';
import MothDetail from './MothDetail';
import HostPlantDetail from './HostPlantDetail';
import './App.css';

// wamei_checklist_ver.1.10.xlsxの情報を元にした科名のマッピング（サンプル）
const plantFamilyMap = {
  'ヤナギ': 'ヤナギ科',
  'ヤナギ類': 'ヤナギ科',
  'クリ': 'ブナ科',
  'クヌギ': 'ブナ科',
  'コナラ': 'ブナ科',
  'ブナ': 'ブナ科',
  'カシワ': 'ブナ科',
  'アラカシ': 'ブナ科',
  'スダジイ': 'ブナ科',
  'リンゴ': 'バラ科',
  'サクラ': 'バラ科',
  'ズミ': 'バラ科',
  'ナナカマド': 'バラ科',
  'マツ': 'マツ科',
  'アカマツ': 'マツ科',
  'トドマツ': 'マツ科',
  'スギ': 'スギ科',
  'ヒノキ': 'ヒノキ科',
  'ヨモギ': 'キク科',
  'キク': 'キク科',
  'アザミ': 'キク科',
  'イネ': 'イネ科',
  'ススキ': 'イネ科',
  'ヨシ': 'イネ科',
  'ササ': 'イネ科',
  'ハンノキ': 'カバノキ科',
  'シラカンバ': 'カバノキ科',
  'ダケカンバ': 'カバノキ科',
  'カエデ': 'ムクロジ科',
  'イタヤカエデ': 'ムクロジ科',
  'ツタ': 'ブドウ科',
  'ブドウ': 'ブドウ科',
  'ヌルデ': 'ウルシ科',
  'ウルシ': 'ウルシ科',
  'ツツジ': 'ツツジ科',
  'アセビ': 'ツツジ科',
  'スイカズラ': 'スイカズラ科',
  'ガマズミ': 'スイカズラ科',
  'クズ': 'マメ科',
  'ハギ': 'マメ科',
  'フジ': 'マメ科',
};

function App() {
  const [moths, setMoths] = useState([]);
  const [hostPlants, setHostPlants] = useState({});
  const [plantDetails, setPlantDetails] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const response = await fetch('/ListMJ_hostplants_integrated_with_bokutou.csv');
      const reader = response.body.getReader();
      const result = await reader.read();
      const decoder = new TextDecoder('utf-8');
      const csv = decoder.decode(result.value);

      Papa.parse(csv, {
        header: true,
        complete: (results) => {
          const mothData = [];
          const hostPlantData = {};
          const plantDetailData = {};

          results.data.forEach((row, index) => {
            const mothName = row['和名'];
            const scientificName = row['学名'];
            const hostPlantString = row['食草'] || '';
            const source = row['出典'] || '不明';

            if (mothName) {
              const hostPlantList = hostPlantString
                .split(';')
                .map(plant => plant.split('（')[0].trim())
                .filter(plant => plant);

              const moth = {
                id: index,
                name: mothName,
                scientificName: scientificName,
                hostPlants: hostPlantList,
                source: source,
              };
              mothData.push(moth);

              hostPlantList.forEach(plant => {
                if (!hostPlantData[plant]) {
                  hostPlantData[plant] = [];
                }
                hostPlantData[plant].push(mothName);

                if (!plantDetailData[plant]) {
                  plantDetailData[plant] = {
                    family: plantFamilyMap[plant] || '不明'
                  };
                }
              });
            }
          });

          setMoths(mothData);
          setHostPlants(hostPlantData);
          setPlantDetails(plantDetailData);
          setLoading(false);
        },
      });
    };

    fetchData();
  }, []);

  return (
    <div className="App">
      <header className="nav-header">
        <nav className="container mx-auto p-4">
          <Link to="/">
            <h1 className="nav-title">”繋がり”が見える蛾類図鑑</h1>
          </Link>
        </nav>
      </header>
      <main>
        {loading ? (
          <div className="text-center p-10">読み込み中...</div>
        ) : (
          <Routes>
            <Route path="/" element={<InsectsHostPlantExplorer moths={moths} hostPlants={hostPlants} plantDetails={plantDetails} />} />
            <Route path="/moth/:mothId" element={<MothDetail moths={moths} hostPlants={hostPlants} />} />
            <Route path="/plant/:plantName" element={<HostPlantDetail moths={moths} hostPlants={hostPlants} plantDetails={plantDetails} />} />
          </Routes>
        )}
      </main>
    </div>
  );
}

export default App;