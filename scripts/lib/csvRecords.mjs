export function splitCsvRecordsWithDelimiters(text) {
  const records = [];
  let start = 0;
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (inQuotes || (char !== '\n' && char !== '\r')) continue;

    const record = text.slice(start, index);
    let delimiter = char;
    if (char === '\r' && text[index + 1] === '\n') {
      delimiter = '\r\n';
      index += 1;
    }
    records.push({ record, delimiter });
    start = index + 1;
  }

  if (inQuotes) throw new Error('CSV has an unterminated quoted field');
  if (start < text.length) records.push({ record: text.slice(start), delimiter: '' });
  return records;
}

export function splitCsvRecords(text) {
  return splitCsvRecordsWithDelimiters(text).map(({ record }) => record);
}
