import { parse } from "csv-parse/sync";

export interface ParsedCsvResult {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

export interface ParseOptions {
  maxRows?: number;
  maxSizeBytes?: number;
}

const DEFAULT_MAX_ROWS = 3000;
const DEFAULT_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Detect the likely delimiter (comma, semicolon, or tab) by analyzing the header row.
 */
export function detectDelimiter(csvText: string): string {
  const firstLine = csvText.split(/\r?\n/).find((line) => line.trim().length > 0) || "";
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  if (semicolonCount > commaCount && semicolonCount >= tabCount) {
    return ";";
  }
  if (tabCount > commaCount && tabCount > semicolonCount) {
    return "\t";
  }
  return ",";
}

/**
 * Parse CSV buffer into headers and row objects with RFC 4180 compliance,
 * automatic BOM stripping, delimiter detection, and whitespace trimming.
 */
export function parseCsv(buffer: Buffer, options: ParseOptions = {}): ParsedCsvResult {
  const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;

  if (!buffer || buffer.length === 0) {
    throw Object.assign(new Error("Uploaded file is empty"), { status: 400 });
  }

  if (buffer.length > maxSizeBytes) {
    throw Object.assign(
      new Error(`File size (${(buffer.length / 1024 / 1024).toFixed(2)} MB) exceeds maximum limit of ${(maxSizeBytes / 1024 / 1024).toFixed(0)} MB`),
      { status: 400 },
    );
  }

  // Convert buffer to string, stripping UTF-8 BOM if present
  let content = buffer.toString("utf8");
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  const delimiter = detectDelimiter(content);

  let rawRecords: Record<string, string>[];
  try {
    rawRecords = parse(content, {
      delimiter,
      bom: true,
      trim: true,
      skip_empty_lines: true,
      columns: true,
      relax_column_count: true,
    });
  } catch (err: any) {
    throw Object.assign(
      new Error(`CSV parsing failed: ${err.message || "Invalid CSV format"}`),
      { status: 400 },
    );
  }

  if (rawRecords.length === 0) {
    throw Object.assign(new Error("CSV contains no data rows"), { status: 400 });
  }

  if (rawRecords.length > maxRows) {
    throw Object.assign(
      new Error(`CSV row count (${rawRecords.length}) exceeds the maximum allowed limit of ${maxRows} rows`),
      { status: 400 },
    );
  }

  // Extract normalized headers from first record keys
  const headers = Object.keys(rawRecords[0]).map((h) => h.trim());

  // Clean values: trim strings, normalize whitespace
  const rows = rawRecords.map((record) => {
    const cleaned: Record<string, string> = {};
    for (const key of Object.keys(record)) {
      const val = record[key];
      cleaned[key.trim()] = typeof val === "string" ? val.trim() : String(val ?? "").trim();
    }
    return cleaned;
  });

  return {
    headers,
    rows,
    totalRows: rows.length,
  };
}

