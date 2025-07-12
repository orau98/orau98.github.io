// 文献名とリンクのマッピング（CiNiiまたはAmazonリンク）
export const sourceLinks = {
  "日本産蛾類標準図鑑1": "https://www.amazon.co.jp/日本産蛾類標準図鑑１-岸田泰則/dp/405403845X",
  "日本産蛾類標準図鑑2": "https://www.amazon.co.jp/s?k=日本産蛾類標準図鑑2+岸田泰則", 
  "日本産蛾類標準図鑑3": "https://www.amazon.co.jp/s?k=日本産蛾類標準図鑑3+岸田泰則",
  "日本産蛾類標準図鑑4": "https://www.amazon.co.jp/s?k=日本産蛾類標準図鑑4+岸田泰則",
  "日本産蝶類標準図鑑": "https://www.amazon.co.jp/日本産蝶類標準図鑑-白水-隆/dp/4052022963",
  "日本産タマムシ大図鑑": "https://www.amazon.co.jp/dp/4832608150"
};

// 出典から参考リンクを取得する関数
export const getSourceLink = (source) => {
  if (!source) return null;
  
  // 部分一致で検索
  for (const [key, link] of Object.entries(sourceLinks)) {
    if (source.includes(key)) {
      return link;
    }
  }
  
  return null;
};