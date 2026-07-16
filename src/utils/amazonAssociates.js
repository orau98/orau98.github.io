export const AMAZON_ASSOCIATE_TAG = 'hostplant01-22';

export const AMAZON_ASSOCIATES_DISCLOSURE = {
  ja: 'Amazonのアソシエイトとして、昆虫植物図鑑は適格販売により収入を得ています。',
  en: 'As an Amazon Associate, Insect Host Plant Database earns from qualifying purchases.',
};

export const buildAmazonBookUrl = (asin) => {
  const normalizedAsin = String(asin || '').trim().toUpperCase();
  if (!/^[0-9A-Z]{10}$/.test(normalizedAsin)) {
    throw new Error(`Invalid Amazon book ASIN/ISBN-10: ${asin}`);
  }

  return `https://www.amazon.co.jp/dp/${normalizedAsin}?tag=${AMAZON_ASSOCIATE_TAG}`;
};

export const isAmazonAssociateUrl = (value) => {
  if (!value) return false;

  try {
    const url = new URL(value);
    if (url.hostname === 'amzn.to') return true;
    return (
      /(^|\.)amazon\.co\.jp$/i.test(url.hostname)
      && url.searchParams.get('tag') === AMAZON_ASSOCIATE_TAG
    );
  } catch {
    return false;
  }
};
