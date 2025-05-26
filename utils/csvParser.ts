// utils/csvParser.ts
export function parseCSV(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((ip) => ip.trim())
    .filter(Boolean);
}