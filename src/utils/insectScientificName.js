const LATIN_NAME = /^(\p{Lu}[\p{Ll}-]+)(?: \((\p{Lu}[\p{Ll}-]+|\?)\))? (\p{Ll}[\p{Ll}-]+)(?: (.*))?$/u;
const LOWERCASE_AUTHOR_PARTICLE = /^(?:d[aieu]|de[lrs]?|dell[ae]|den|der|dos|la|le|ten|ter|van|von|zu[mr]?)\b/i;
const OPEN_NAME = /^(?:spp?|cf|aff|indet|nr)\.?$/i;
const TAXON_QUALIFIER = /^(?:auct|sensu|nec|non|stat|partim|group|complex|of|ex|in|form|var|ssp|subsp)\b|^(?:n|f|sp)\.(?= *(?:sp\.|n\.|[a-z]|$))/u;

export function splitInsectScientificName(value = '') {
  const raw = String(value || '').trim();
  const match = LATIN_NAME.exec(raw.replace(/\s+/g, ' ').replace(/[（]/g, '(').replace(/[）]/g, ')'));
  if (!match) return { name: raw, parts: [], authority: '', remainder: '' };
  const [, genus, subgenus, species, extra = ''] = match;
  if (OPEN_NAME.test(species)) return { name: raw, parts: [], authority: '', remainder: '' };
  const words = extra.split(' ').filter(Boolean);
  const subspecies = /^\p{Ll}[\p{Ll}-]+$/u.test(words[0] || '')
    && !LOWERCASE_AUTHOR_PARTICLE.test(words[0])
    && !TAXON_QUALIFIER.test(words[0]) ? words.shift() : '';
  const suffix = words.join(' ');
  const authority = /\p{Lu}/u.test(suffix) && !TAXON_QUALIFIER.test(suffix) ? suffix : '';
  const name = [genus, subgenus ? '(' + subgenus + ')' : '', species, subspecies].filter(Boolean).join(' ');
  const remainder = authority ? '' : suffix;
  return { name: remainder ? name + ' ' + remainder : name, parts: [genus, subgenus, species, subspecies], authority, remainder };
}

export function insectHeadingName(label, scientificName = '') {
  const value = String(label || '').trim();
  const parts = splitInsectScientificName(value);
  if (!parts.authority) return value;
  return parts.name === splitInsectScientificName(scientificName).name ? parts.name : value;
}

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function formatInsectScientificNameHTML(value) {
  const { name, parts, authority, remainder } = splitInsectScientificName(value);
  if (!parts.length) return escapeHtml(name);
  const [genus, subgenus, species, subspecies] = parts;
  const emphasis = (word) => '<em>' + escapeHtml(word) + '</em>';
  const scientific = [
    emphasis(genus), subgenus && '(' + (subgenus === '?' ? subgenus : emphasis(subgenus)) + ')',
    emphasis(species),
    subspecies ? emphasis(subspecies) : '',
  ].filter(Boolean).join(' ');
  return scientific + (authority ? ' <span class="sci-author">' + escapeHtml(authority) + '</span>' : '')
    + (remainder ? ' ' + escapeHtml(remainder) : '');
}

// Retain published URLs for records whose source name was repaired.
const LEGACY_ROUTES = {
  "species-21150": "Tuberculatus yokoyamai",
  "species-21171": "Chaitophorus saliniger Shinji",
  "species-21179": "Periphyllus californiensis",
  "species-21411": "Indomegoura indica",
  "species-21404": "Hyperomyzus carduellinus",
  "species-21410": "Impatientinum impatiens",
  "species-21380": "Cryptaphis geranicola",
  "species-21346": "Capitophorus elaeagni",
  "species-21348": "Capitophorus formosartemisiae",
  "species-21413": "Kaochiaoja arthraxonis",
  "species-21397": "Eumyzus impatiensae",
  "species-21364": "Cavariella japonica",
  "species-21368": "Cavariella salicicola",
  "species-21419": "Macchiatiella itadori",
  "species-21390": "Dysaphis plantaginea",
  "species-21389": "Dysaphis tulipae",
  "species-21416": "Lipaphis erysimi",
  "species-21418": "Longicaudus trirhodus",
  "species-21341": "Brachycaudus helichrysi",
  "species-21344": "Brevicoryne brassicae",
  "species-21379": "Coloradoa rufomaculata",
  "species-21233": "Aphis egomae",
  "species-21240": "Aphis forbesi",
  "species-21241": "Aphis fukii",
  "species-21242": "Aphis glycines",
  "species-21244": "Aphis gossypii",
  "species-21249": "Aphis ichigo",
  "species-21188": "Cervaphis quercus Takahashi",
  "species-21193": "Eutrichosiphum pasaniae",
  "species-21195": "Eutrichosiphum sinense RayChaudhuri",
  "species-21200": "Greenidea kuwanai",
  "species-21203": "Greenidea nipponica",
  "species-21204": "Greenidea okajimai",
  "species-21209": "Mollitrichosiphum nigrofasciatum",
  "species-H804": "Aphthona yuasai Ohno, 196",
  "species-H924": "Cassida viridis japonica Yasutomi",
  "species-H769": "Gonioctena (Gonioctena) kamiyai Kimoto, 1963 3769",
  "species-20453": "Diplodoma herminata Psychidae, 675",
  "species-21151": "Tuberculatus fulviabdominalis",
  "species-21158": "Chaitophorus abdominalis Shinji",
  "species-21165": "Chaitophorus narae Shinji",
  "species-21166": "Chaitophorus populeti",
  "species-21169": "Chaitophorus saliapterus Shinji",
  "species-21177": "Yamatochaitophorus albus",
  "species-21181": "Periphyllus koelreuteriae",
  "species-21182": "Periphyllus kuwanaii",
  "species-21185": "Periphyllus viridis",
  "species-21186": "Periphyllus viridis osugicnsis Sorin",
  "species-21189": "Allotrichosiphum kashicola",
  "species-21191": "Eutrichosiphum heterotrichum",
  "species-21196": "Eutrichosiphum tattakanum",
  "species-21205": "Greenidea prinicola",
  "species-21216": "Pterocomma yezoense",
  "species-21226": "Aphis clerodendri clerodendri",
  "species-21229": "Aphis craccivora craccivora",
  "species-21238": "Aphis farinosa yanagicola",
  "species-21246": "Aphis hederiphaga",
  "species-21325": "Aulacorthum kerriae",
  "species-21326": "Aulacorthum linderae",
  "species-21327": "Aulacorthum muradachi",
  "species-21331": "Aulacorthum solani",
  "species-21335": "Aulacorthum watanabei",
  "species-21336": "Aulacorthum circumflexum",
  "species-21337": "Aulacorthum codonopsis",
  "species-21338": "Aulacorthum parthenocissi",
  "species-21339": "Aulacorthum perillae",
  "species-21356": "Carolinaia floris",
  "species-21357": "Carolinaia japonica",
  "species-21358": "Carolinaia nigra",
  "species-21359": "Carolinaia obscura",
  "species-21360": "Cavariella aegopodii",
  "species-21374": "Chaetosiphon hirticorne",
  "species-21375": "Chaetosiphon coreanum",
  "species-21376": "Chaetosiphon fragaefolii",
  "species-21377": "Chaetosiphon minor",
  "species-21386": "Dysaphis radicola",
  "species-21387": "Dysaphis rumecicola",
  "species-21388": "Dysaphis taisetsusana",
  "species-21393": "Ericolophium itoe",
  "species-21398": "Hayhurstia atriplicis",
  "species-21407": "Illinoia liriodendri",
  "species-21408": "Illinoia lambersi",
  "species-21409": "Impatientinum balsamines",
  "species-21412": "Indomegoura nigrotibiae",
  "species-21417": "Longicaudus corydalisicola",
  "species-22063": "Gnatholea loochgooana Ohbayashi & Ohbayashi",
  "species-22150": "Pyrestes haematicus Pascoe"
};

export const getLegacyInsectRoute = (id) => LEGACY_ROUTES[id] || '';
