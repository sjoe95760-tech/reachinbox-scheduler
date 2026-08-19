import { parse } from "csv-parse/sync";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Accepts raw CSV/text file content and returns a deduplicated list of
 * valid-looking email addresses. Works whether the file has a header row,
 * an "email" column, or is just one address per line.
 */
export function extractEmailsFromFile(fileContent: string): string[] {
  const emails = new Set<string>();

  // Try CSV parsing first (handles multi-column files with an email column)
  try {
    const records: Record<string, string>[] = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    for (const record of records) {
      for (const value of Object.values(record)) {
        if (value && EMAIL_REGEX.test(value)) {
          emails.add(value.toLowerCase());
        }
      }
    }
  } catch {
    // Not valid CSV-with-headers - fall through to plain line scanning below
  }

  // Fallback / supplement: scan every line for anything email-shaped
  // (covers plain .txt lists, or CSVs without headers)
  const lines = fileContent.split(/\r?\n/);
  for (const line of lines) {
    const candidates = line.split(/[,;\s]+/);
    for (const c of candidates) {
      const trimmed = c.trim();
      if (EMAIL_REGEX.test(trimmed)) {
        emails.add(trimmed.toLowerCase());
      }
    }
  }

  return Array.from(emails);
}
