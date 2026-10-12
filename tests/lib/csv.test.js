import { describe, it, expect } from 'vitest';
import { csvField, csvRow, csvDocument, csvDataUri } from '@/lib/csv';

describe('CSV escaping (C2)', () => {
  it('wraps every field in quotes and doubles inner quotes', () => {
    expect(csvField('Acme "Global", Ltd')).toBe('"Acme ""Global"", Ltd"');
    expect(csvField('line1\nline2')).toBe('"line1\nline2"');
    expect(csvField(42)).toBe('"42"');
    expect(csvField(0)).toBe('"0"');
    expect(csvField(null)).toBe('""');
    expect(csvField(undefined)).toBe('""');
  });
  it('joins a row and a document', () => {
    expect(csvRow(['a"b', 'c,d', 3])).toBe('"a""b","c,d","3"');
    expect(csvDocument(['Name', 'Hours'], [['Ann', 2], ['Bo "B"', 0]])).toBe('"Name","Hours"\n"Ann","2"\n"Bo ""B""","0"\n');
  });
  it('a field with a comma or quote stays one column when parsed back', () => {
    const doc = csvDocument(['A', 'B'], [['x, "y"', 'z']]);
    // A minimal RFC 4180 parse of the data line.
    const line = doc.split('\n')[1];
    const cells = [...line.matchAll(/"((?:[^"]|"")*)"/g)].map((m) => m[1].replace(/""/g, '"'));
    expect(cells).toEqual(['x, "y"', 'z']);
  });
  it('encodes the whole document into a data URI, including # and %', () => {
    const uri = csvDataUri('"a#1","50%"\n');
    expect(uri.startsWith('data:text/csv;charset=utf-8,')).toBe(true);
    expect(decodeURIComponent(uri.slice('data:text/csv;charset=utf-8,'.length))).toBe('"a#1","50%"\n');
    expect(uri).not.toContain('#');
  });
});
