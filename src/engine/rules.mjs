export const severity = {
  SUPPORTED: 0,
  CONDITIONAL: 1,
  RETEST: 2,
  CONFLICTED: 3,
  INSUFFICIENT: 4,
  AVOID: 5,
};
export const worse = (a, b) => (severity[b] > severity[a] ? b : a);
export function yearsBetween(a, b) {
  if (!a || !b) return null;
  const da = new Date(a),
    db = new Date(b);
  if (Number.isNaN(da.valueOf()) || Number.isNaN(db.valueOf())) return null;
  return (db - da) / (365.2425 * 86400000);
}
export function testConflict(results) {
  const n = [...new Set(results.filter(Boolean))];
  if (n.length <= 1) return 'AGREES';
  if (n.includes('U') && n.includes('P')) return 'MAJOR_CONFLICT';
  return 'MINOR_CONFLICT';
}
