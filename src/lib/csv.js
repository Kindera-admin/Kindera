// CSV for spreadsheet exports. Every field is quoted and inner quotes are
// doubled (RFC 4180), so commas, quotes and line breaks stay inside one cell.

export function csvField(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function csvRow(fields) {
  return fields.map(csvField).join(',');
}

export function csvDocument(header, rows) {
  return `${[header, ...rows].map(csvRow).join('\n')}\n`;
}

// encodeURIComponent, not encodeURI: encodeURI leaves '#' alone, which would
// end the data URI early and cut the file off at the first '#'.
export function csvDataUri(csv) {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}
