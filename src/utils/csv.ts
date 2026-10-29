export function parseCsvRecords(input: string): string[][] {
  const source = input.replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (inQuotes) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      inQuotes = true;
    } else if (character === ',') {
      record.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
      if (character === '\r' && source[index + 1] === '\n') index += 1;
    } else {
      field += character;
    }
  }

  if (inQuotes) throw new Error('CSV_UNCLOSED_QUOTE');
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records;
}
