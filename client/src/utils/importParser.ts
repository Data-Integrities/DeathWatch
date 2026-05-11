import * as XLSX from 'xlsx';

// ── Types ──────────────────────────────────────────────────────────────

export interface ParsedRow {
  [key: string]: string;
}

export interface ParseResult {
  headers: string[];
  rows: ParsedRow[];
  warnings: string[];
  sheetCount?: number;
}

export type ImportField =
  | 'nameFirst'
  | 'nameLast'
  | 'nameMiddle'
  | 'nameMaiden'
  | 'nameNickname'
  | 'ageApx'
  | 'city'
  | 'state'
  | 'keyWords';

export const IMPORT_FIELDS: { key: ImportField; label: string }[] = [
  { key: 'nameFirst', label: 'First Name' },
  { key: 'nameLast', label: 'Last Name' },
  { key: 'nameMiddle', label: 'Middle Name' },
  { key: 'nameMaiden', label: 'Maiden Name' },
  { key: 'nameNickname', label: 'Nickname' },
  { key: 'ageApx', label: 'Approx. Age' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'keyWords', label: 'Keywords' },
];

export type ColumnMapping = Record<number, ImportField | 'skip'>;

// ── Text normalization ─────────────────────────────────────────────────

function stripBOM(text: string): string {
  if (text.charCodeAt(0) === 0xFEFF) return text.slice(1);
  return text;
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function normalizeUnicode(text: string): string {
  return text
    .replace(/[“”„‟]/g, '"')  // smart double quotes
    .replace(/[‘’‚‛]/g, "'")   // smart single quotes
    .replace(/—/g, '--')                        // em dash
    .replace(/–/g, '-')                         // en dash
    .replace(/ /g, ' ')                         // non-breaking space
    .replace(/[​‌‍﻿]/g, '')     // zero-width chars
    .replace(/[‪-‮⁦-⁩]/g, '');  // direction marks
}

function cleanText(raw: string): string {
  return stripBOM(normalizeLineEndings(normalizeUnicode(raw)));
}

function trimCell(value: string): string {
  return normalizeUnicode(value).trim();
}

// ── State normalization ────────────────────────────────────────────────

const STATE_NAME_TO_CODE: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX',
  'utah': 'UT', 'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA',
  'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
  'district of columbia': 'DC',
  'alberta': 'AB', 'british columbia': 'BC', 'manitoba': 'MB',
  'new brunswick': 'NB', 'newfoundland and labrador': 'NL', 'nova scotia': 'NS',
  'northwest territories': 'NT', 'nunavut': 'NU', 'ontario': 'ON',
  'prince edward island': 'PE', 'quebec': 'QC', 'saskatchewan': 'SK', 'yukon': 'YT',
};

export const VALID_STATE_CODES = new Set(Object.values(STATE_NAME_TO_CODE));

export function normalizeState(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const upper = trimmed.toUpperCase();
  if (VALID_STATE_CODES.has(upper)) return upper;
  const mapped = STATE_NAME_TO_CODE[trimmed.toLowerCase()];
  if (mapped) return mapped;
  return trimmed;
}

// ── Age cleanup ────────────────────────────────────────────────────────

export function normalizeAge(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10);
  if (num < 0 || num > 150) return '';
  return String(num);
}

// ── Row normalization ──────────────────────────────────────────────────

export interface MappedRow {
  nameFirst: string | null;
  nameLast: string | null;
  nameMiddle: string | null;
  nameMaiden: string | null;
  nameNickname: string | null;
  ageApx: number | null;
  city: string | null;
  state: string | null;
  keyWords: string | null;
}

export function applyMapping(row: ParsedRow, headers: string[], mapping: ColumnMapping): MappedRow {
  const result: MappedRow = {
    nameFirst: null, nameLast: null, nameMiddle: null,
    nameMaiden: null, nameNickname: null, ageApx: null,
    city: null, state: null, keyWords: null,
  };

  for (const [colIdx, field] of Object.entries(mapping)) {
    if (field === 'skip') continue;
    const header = headers[Number(colIdx)];
    const raw = row[header] ?? '';
    const val = trimCell(raw);
    if (!val) continue;

    if (field === 'state') {
      result.state = normalizeState(val) || null;
    } else if (field === 'ageApx') {
      const age = normalizeAge(val);
      result.ageApx = age ? parseInt(age, 10) : null;
    } else {
      result[field] = val;
    }
  }

  return result;
}

// ── CSV / TSV parsing (RFC 4180 compliant) ─────────────────────────────

function parseDelimited(text: string, delimiter: string): string[][] {
  const cleaned = cleanText(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;

  while (i < cleaned.length) {
    const ch = cleaned[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < cleaned.length && cleaned[i + 1] === '"') {
          cell += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        cell += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === delimiter) {
        row.push(cell);
        cell = '';
        i++;
      } else if (ch === '\n') {
        row.push(cell);
        cell = '';
        if (row.some(c => c.trim() !== '')) rows.push(row);
        row = [];
        i++;
      } else {
        cell += ch;
        i++;
      }
    }
  }

  // Last cell/row
  row.push(cell);
  if (row.some(c => c.trim() !== '')) rows.push(row);

  return rows;
}

function gridToParseResult(grid: string[][], hasHeaders: boolean): ParseResult {
  const warnings: string[] = [];

  if (grid.length === 0) {
    return { headers: [], rows: [], warnings: ['File is empty.'] };
  }

  let headers: string[];
  let dataStart: number;

  if (hasHeaders) {
    headers = grid[0].map(h => trimCell(h));
    dataStart = 1;
  } else {
    headers = grid[0].map((_, i) => `Column ${i + 1}`);
    dataStart = 0;
  }

  const expectedCols = headers.length;
  const rows: ParsedRow[] = [];

  for (let r = dataStart; r < grid.length; r++) {
    const raw = grid[r];
    if (raw.length !== expectedCols) {
      warnings.push(`Row ${r + 1}: expected ${expectedCols} columns, got ${raw.length}.`);
    }
    const obj: ParsedRow = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = trimCell(raw[c] ?? '');
    }
    rows.push(obj);
  }

  return { headers, rows, warnings };
}

export function parseCSV(text: string, hasHeaders: boolean): ParseResult {
  const grid = parseDelimited(text, ',');
  return gridToParseResult(grid, hasHeaders);
}

export function parseTSV(text: string, hasHeaders: boolean): ParseResult {
  const grid = parseDelimited(text, '\t');
  return gridToParseResult(grid, hasHeaders);
}

// ── JSON parsing ───────────────────────────────────────────────────────

export function parseJSON(text: string): ParseResult {
  const warnings: string[] = [];
  const cleaned = cleanText(text);
  let data: any;
  try {
    data = JSON.parse(cleaned);
  } catch {
    return { headers: [], rows: [], warnings: ['Invalid JSON file.'] };
  }

  const arr = Array.isArray(data) ? data : [data];
  if (arr.length === 0) {
    return { headers: [], rows: [], warnings: ['JSON array is empty.'] };
  }

  const headerSet = new Set<string>();
  for (const item of arr) {
    if (typeof item === 'object' && item !== null) {
      Object.keys(item).forEach(k => headerSet.add(k));
    }
  }
  const headers = Array.from(headerSet);

  const rows: ParsedRow[] = arr
    .filter(item => typeof item === 'object' && item !== null)
    .map(item => {
      const obj: ParsedRow = {};
      for (const h of headers) {
        const v = item[h];
        obj[h] = v != null ? trimCell(String(v)) : '';
      }
      return obj;
    });

  return { headers, rows, warnings };
}

// ── XLS/XLSX parsing ───────────────────────────────────────────────────

export function parseExcel(buffer: ArrayBuffer, hasHeaders: boolean): ParseResult {
  const warnings: string[] = [];
  const workbook = XLSX.read(buffer, { type: 'array' });

  if (workbook.SheetNames.length > 1) {
    warnings.push(`Workbook has ${workbook.SheetNames.length} sheets.  Only the first sheet ("${workbook.SheetNames[0]}") will be imported.`);
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const grid: string[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });

  const result = gridToParseResult(grid, hasHeaders);
  result.warnings.push(...warnings);
  result.sheetCount = workbook.SheetNames.length;
  return result;
}

// ── File dispatcher ────────────────────────────────────────────────────

export type FileType = 'csv' | 'tsv' | 'json' | 'xls';

export function detectFileType(filename: string): FileType | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'csv': return 'csv';
    case 'tsv':
    case 'tab': return 'tsv';
    case 'json': return 'json';
    case 'xls':
    case 'xlsx': return 'xls';
    default: return null;
  }
}

export async function parseFile(
  file: File,
  hasHeaders: boolean,
): Promise<ParseResult> {
  const type = detectFileType(file.name);
  if (!type) {
    return { headers: [], rows: [], warnings: [`Unsupported file type: ${file.name}`] };
  }

  if (type === 'json') {
    const text = await file.text();
    return parseJSON(text);
  }

  if (type === 'xls') {
    const buffer = await file.arrayBuffer();
    return parseExcel(buffer, hasHeaders);
  }

  // CSV or TSV — try to detect encoding
  const text = await readFileWithEncoding(file);

  if (type === 'tsv') return parseTSV(text, hasHeaders);
  return parseCSV(text, hasHeaders);
}

// ── Encoding detection ─────────────────────────────────────────────────

async function readFileWithEncoding(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Check for UTF-8 BOM
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return new TextDecoder('utf-8').decode(buffer);
  }

  // Check for UTF-16 BOM
  if ((bytes[0] === 0xFF && bytes[1] === 0xFE) || (bytes[0] === 0xFE && bytes[1] === 0xFF)) {
    return new TextDecoder('utf-16').decode(buffer);
  }

  // Try UTF-8 first
  const utf8 = new TextDecoder('utf-8', { fatal: true });
  try {
    return utf8.decode(buffer);
  } catch {
    // Fall back to Windows-1252 (covers Latin-1 accented chars)
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

// ── Auto-mapping heuristic ─────────────────────────────────────────────

const HEADER_HINTS: Record<ImportField, string[]> = {
  nameFirst: ['first', 'first name', 'first_name', 'firstname', 'fname', 'given', 'given name', 'given_name'],
  nameLast: ['last', 'last name', 'last_name', 'lastname', 'lname', 'surname', 'family', 'family name', 'family_name'],
  nameMiddle: ['middle', 'middle name', 'middle_name', 'middlename', 'mname', 'mi', 'middle initial', 'middle_initial'],
  nameMaiden: ['maiden', 'maiden name', 'maiden_name', 'maidenname', 'nee', 'born as', 'birth name', 'birth_name'],
  nameNickname: ['nick', 'nickname', 'nick name', 'nick_name', 'alias', 'aka', 'also known as'],
  ageApx: ['age', 'approx age', 'approx_age', 'approximate age', 'apx age', 'apx_age', 'years', 'age approx'],
  city: ['city', 'town', 'municipality', 'locale', 'location'],
  state: ['state', 'st', 'province', 'region', 'state/province'],
  keyWords: ['keywords', 'key words', 'key_words', 'tags', 'notes', 'keyword'],
};

export function autoMapHeaders(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};

  const usedFields = new Set<ImportField>();

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase().trim();
    let matched: ImportField | null = null;

    for (const [field, hints] of Object.entries(HEADER_HINTS) as [ImportField, string[]][]) {
      if (usedFields.has(field)) continue;
      if (hints.includes(h)) {
        matched = field;
        break;
      }
    }

    if (matched) {
      mapping[i] = matched;
      usedFields.add(matched);
    } else {
      mapping[i] = 'skip';
    }
  }

  return mapping;
}

// ── Duplicate detection helper ─────────────────────────────────────────

export function findDuplicates(
  newRows: MappedRow[],
  existingSearches: { nameFirst: string | null; nameLast: string | null; city: string | null }[],
): number[] {
  const existingSet = new Set(
    existingSearches.map(s =>
      `${(s.nameFirst || '').toLowerCase()}|${(s.nameLast || '').toLowerCase()}|${(s.city || '').toLowerCase()}`
    )
  );

  const dupeIndices: number[] = [];
  for (let i = 0; i < newRows.length; i++) {
    const r = newRows[i];
    const key = `${(r.nameFirst || '').toLowerCase()}|${(r.nameLast || '').toLowerCase()}|${(r.city || '').toLowerCase()}`;
    if (existingSet.has(key)) {
      dupeIndices.push(i);
    }
  }

  return dupeIndices;
}

// ── Row validation ────────────────────────────────────────────────────

export function validateRow(row: MappedRow): string[] {
  const reasons: string[] = [];

  if (!row.nameFirst) {
    reasons.push('first_name missing');
  }

  if (!row.nameLast && !row.nameMaiden) {
    reasons.push('last and maiden names are missing');
  }

  if (!row.city) {
    reasons.push('city missing');
  }

  if (!row.state) {
    reasons.push('state missing');
  } else if (!VALID_STATE_CODES.has(row.state)) {
    reasons.push(`${row.state} is not a valid state abbreviation`);
  }

  if (row.ageApx == null) {
    reasons.push('approx_age missing');
  }

  return reasons;
}

// ── Reject file generation ────────────────────────────────────────────

export interface RejectedRow {
  originalRow: ParsedRow;
  reasons: string;
}

function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

function tsvEscape(val: string): string {
  return val.replace(/[\t\n\r]/g, ' ');
}

export function generateRejectFile(
  fileType: FileType,
  headers: string[],
  rejected: RejectedRow[],
): string {
  if (fileType === 'json') {
    const arr = rejected.map(r => ({
      ...r.originalRow,
      reject_reason: r.reasons,
    }));
    return JSON.stringify(arr, null, 2);
  }

  const delimiter = fileType === 'tsv' ? '\t' : ',';
  const escape = fileType === 'tsv' ? tsvEscape : csvEscape;

  const allHeaders = [...headers, 'reject_reason'];
  const lines: string[] = [allHeaders.map(h => escape(h)).join(delimiter)];

  for (const r of rejected) {
    const cells = headers.map(h => escape(r.originalRow[h] || ''));
    cells.push(escape(r.reasons));
    lines.push(cells.join(delimiter));
  }

  return lines.join('\n');
}

export function getRejectFileName(originalName: string): string {
  const lastDot = originalName.lastIndexOf('.');
  const name = lastDot > 0 ? originalName.substring(0, lastDot) : originalName;
  const ext = lastDot > 0 ? originalName.substring(lastDot).toLowerCase() : '';
  const outputExt = ext === '.xls' || ext === '.xlsx' ? '.csv' : ext;
  return `${name}_REJECTS${outputExt}`;
}
