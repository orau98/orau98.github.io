// 文献名とリンクのマッピング（CiNiiまたはAmazonリンク）
export const sourceLinks = {
  "日本産蛾類標準図鑑1": "https://www.amazon.co.jp/日本産蛾類標準図鑑１-岸田泰則/dp/405403845X",
  "日本産蛾類標準図鑑2": "https://www.amazon.co.jp/%E6%97%A5%E6%9C%AC%E7%94%A3%E8%9B%BE%E9%A1%9E%E6%A8%99%E6%BA%96%E5%9B%B3%E9%91%91%EF%BC%92-%E5%B2%B8%E7%94%B0%E6%B3%B0%E5%89%87/dp/4054038468", 
  "日本産蛾類標準図鑑3": "https://www.amazon.co.jp/%E6%97%A5%E6%9C%AC%E7%94%A3%E8%9B%BE%E9%A1%9E%E6%A8%99%E6%BA%96%E5%9B%B3%E9%91%913-%E9%82%A3%E9%A0%88%E7%BE%A9%E6%AC%A1/dp/405405109X",
  "日本産蛾類標準図鑑4": "https://www.amazon.co.jp/s?k=日本産蛾類標準図鑑4+岸田泰則",
  "日本産蝶類標準図鑑": "https://www.amazon.co.jp/日本産蝶類標準図鑑-白水-隆/dp/4052022963",
  "日本産タマムシ大図鑑": "https://www.amazon.co.jp/dp/4832608150",
  "ハムシハンドブック": "https://amzn.to/456YVhu"
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