/**
 * RFC 4180 compliant CSV serializer.
 * Handles quoting, embedded quotes, commas, CRLF, and UTF-8 BOM.
 */
export function serializeToCsv(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
): string {
  const escapeCell = (val: string | number | boolean | null | undefined): string => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (
      str.includes(",") ||
      str.includes('"') ||
      str.includes("\n") ||
      str.includes("\r") ||
      str.includes(";")
    ) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeCell).join(",");
  const dataLines = rows.map((row) => row.map(escapeCell).join(","));

  // Include UTF-8 BOM so Excel opens it with proper character encoding
  return "\uFEFF" + [headerLine, ...dataLines].join("\r\n");
}

