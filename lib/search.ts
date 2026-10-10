/** `ILIKE` pattern for a "contains" search, with LIKE wildcards escaped. */
export function containsPattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
