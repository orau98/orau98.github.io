import { normalizePlantKey } from './plantNameUtils.js';

// Examples name a specific insect, plant part and, where the source states it,
// life stage. The records themselves stay in the source data.
const OBSERVATION_GUIDES = new Map([
  ['コナラ', {
    title: 'コナラにつく虫｜葉・ドングリを利用する昆虫｜昆虫植物図鑑',
    description: 'コナラの葉で記録された蛾の幼虫とハムシの成虫、ドングリを利用するハマキガの幼虫を、写真や出典のある図鑑ページから調べられます。',
    sections: [
      {
        label: '葉',
        text: '葉を利用する蛾の幼虫やハムシの成虫が記録されています。',
        examples: [
          { id: 'species-0084', part: '葉', stage: '幼虫' },
          { id: 'species-H602', part: '葉', stage: '成虫' },
        ],
      },
      {
        label: 'ドングリ',
        text: 'ドングリの中に潜る幼虫の記録があります。',
        examples: [
          { id: 'species-6157', part: '堅果', stage: '幼虫' },
        ],
      },
    ],
  }],
  ['ケヤキ', {
    title: 'ケヤキ（欅）につく虫｜葉・虫こぶ・樹皮の記録｜昆虫植物図鑑',
    description: 'ケヤキの葉を利用する蛾やハムシ、虫こぶを作るアブラムシ、樹皮の下で記録されたキクイムシを、出典付きの記録から調べられます。',
    sections: [
      {
        label: '葉',
        text: '葉を利用する蛾の幼虫とハムシの成虫の記録があります。',
        examples: [
          { id: 'species-0082', part: '葉', stage: '幼虫' },
          { id: 'species-H281', part: '葉', stage: '成虫' },
        ],
      },
      {
        label: '虫こぶ',
        text: 'ケヤキで虫こぶを作るアブラムシが記録されています。',
        examples: [
          { id: 'species-21059', part: 'クマザサの根、ケヤキでは虫癭' },
        ],
      },
      {
        label: '樹皮の下',
        text: '樹皮下を利用するキクイムシの記録があります。',
        examples: [
          { id: 'species-SC215', part: '樹皮下' },
        ],
      },
    ],
  }],
  ['サクラ', {
    title: 'サクラにつく虫｜葉を利用する幼虫と成虫｜昆虫植物図鑑',
    description: 'サクラの葉を利用するモンクロシャチホコなどの蛾の幼虫や、クワノミハムシなどの成虫を、出典付きの記録から調べられます。',
    sections: [
      {
        label: '葉で見つけた幼虫',
        text: '葉を利用する蛾の幼虫の記録があります。',
        examples: [
          { id: 'species-4589', part: '葉', stage: '幼虫' },
          { id: 'species-2168', part: '葉', stage: '幼虫' },
        ],
      },
      {
        label: '葉で見つけた成虫',
        text: 'サクラの葉を利用するハムシの成虫も記録されています。',
        examples: [
          { id: 'species-H145', part: '葉', stage: '成虫' },
          { id: 'species-H276', part: '葉', stage: '成虫' },
        ],
      },
    ],
  }],
]);

export const PLANT_OBSERVATION_HEADING = '見つけた場所から虫を調べる';
export const PLANT_OBSERVATION_NOTE = '掲載例を手がかりに、虫の姿や利用部位、出典を種のページで確認できます。';

export function getPlantObservationGuide(plantName, insects) {
  const guide = OBSERVATION_GUIDES.get(plantName);
  if (!guide) return null;

  const byId = new Map(insects.map((insect) => [insect.id, insect]));
  const sections = guide.sections.map(({ label, text, examples }) => ({
    label,
    text,
    insects: examples.map(({ id, part, stage }) => {
      const insect = byId.get(id);
      const records = insect?.hostPlantsDetailed;
      const hasRecord = Array.isArray(records) && records.some((record) =>
        record?.reference &&
        normalizePlantKey(record.displayName || record.name || record.plant) === plantName &&
        record.plantPart === part &&
        (!stage || record.lifeStage === stage));
      return hasRecord ? insect : null;
    }).filter(Boolean),
  })).filter((section) => section.insects.length > 0);

  return sections.length > 0 ? { ...guide, sections } : null;
}
