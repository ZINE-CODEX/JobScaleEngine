// Shared by sync-sponsors.js and sync-jobs.js so both sides normalise
// company names the same way before they are compared.

const LEGAL_SUFFIXES = /\b(limited|ltd|plc|llp|llc|lp|inc|incorporated|cic)\b/g;

export function normalizeCompanyName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ') // drop punctuation
    .replace(LEGAL_SUFFIXES, ' ') // drop "Ltd", "Limited", "PLC", ...
    .replace(/\s+/g, ' ')
    .trim();
}
