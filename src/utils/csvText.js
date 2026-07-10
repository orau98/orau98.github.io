export const normalizeCsvLineEndings = (text) => String(text ?? '')
  .replace(/\r\n|\r|\n/g, '\n');
