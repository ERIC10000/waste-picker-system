/**
 * Display formatters shared by the tables and the PDF reports.
 *
 * Deliberately free of any dependency on jsPDF: the report pages need these
 * at module load, but the PDF engine itself is imported only when someone
 * actually asks for a download.
 */

export const fmtDate = (v) =>
  v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const fmtDateTime = (d = new Date()) =>
  d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

export const titleCase = (v) =>
  v ? String(v).replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) : '—';

/** Stored role values are terse; reports carry the names people actually use. */
const ROLE_LABELS = {
  picker: 'Waste Picker',
  community_leader: 'Community Leader',
  data_collector: 'Data Collector',
};
export const roleLabel = (v) => ROLE_LABELS[v] || titleCase(v);

const MATERIAL_LABELS = { e_waste: 'E-Waste' };
export const materialLabel = (v) => MATERIAL_LABELS[v] || titleCase(v);
