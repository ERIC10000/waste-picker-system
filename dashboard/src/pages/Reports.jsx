import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { fmtDate, fmtDateTime, roleLabel, titleCase } from '../lib/format.js';

const TABS = [
  ['registrations', 'Registrations'],
  ['by-region', 'By region'],
  ['communication', 'Communication reach'],
  ['collections', 'Community activity'],
];

/**
 * One definition per report drives both the on-screen table and the PDF, so
 * the printed document can never drift from what the coordinator reviewed.
 */
const REPORTS = {
  registrations: {
    title: 'Waste Picker Registrations',
    subtitle: 'Register of registered waste pickers',
    orientation: 'landscape',
    file: 'waste-picker-registrations',
    toneColumn: 'status',
    columns: [
      { key: 'picker_id', label: 'Picker ID', mono: true, width: 34, value: (r) => r.picker_id || '—' },
      { key: 'full_name', label: 'Name', bold: true, value: (r) => r.full_name || '—' },
      { key: 'phone', label: 'Phone', mono: true, width: 30, value: (r) => r.phone || '—' },
      { key: 'gender', label: 'Gender', width: 20, value: (r) => titleCase(r.gender) },
      { key: 'region', label: 'County', width: 26, value: (r) => r.region || '—' },
      { key: 'status', label: 'Status', width: 24, value: (r) => titleCase(r.status) },
      { key: 'role', label: 'Role', width: 32, value: (r) => roleLabel(r.role) },
      { key: 'created_at', label: 'Registered', width: 26, value: (r) => fmtDate(r.created_at) },
    ],
    summary: (rows) => [
      { value: rows.length, label: 'Records' },
      { value: rows.filter((r) => r.status === 'approved').length, label: 'Approved' },
      { value: rows.filter((r) => r.status === 'pending').length, label: 'Pending' },
      { value: new Set(rows.map((r) => r.region)).size, label: 'Counties' },
    ],
  },

  'by-region': {
    title: 'Registrations by County',
    subtitle: 'Distribution across the Lake Victoria basin',
    orientation: 'portrait',
    file: 'registrations-by-county',
    columns: [
      { key: 'region', label: 'County', bold: true, value: (r) => r.region },
      { key: 'total', label: 'Total', align: 'right', width: 22, value: (r) => r.total },
      { key: 'approved', label: 'Approved', align: 'right', width: 25, value: (r) => r.approved },
      { key: 'pending', label: 'Pending', align: 'right', width: 24, value: (r) => r.pending },
      { key: 'rejected', label: 'Rejected', align: 'right', width: 24, value: (r) => r.rejected },
      { key: 'suspended', label: 'Suspended', align: 'right', width: 27, value: (r) => r.suspended },
    ],
    summary: (rows) => [
      { value: rows.length, label: 'Counties' },
      { value: rows.reduce((s, r) => s + Number(r.total || 0), 0), label: 'Registered' },
      { value: rows.reduce((s, r) => s + Number(r.approved || 0), 0), label: 'Approved' },
      { value: rows.reduce((s, r) => s + Number(r.pending || 0), 0), label: 'Pending' },
    ],
  },

  communication: {
    title: 'Communication Reach',
    subtitle: 'Broadcast delivery and readership',
    orientation: 'landscape',
    file: 'communication-reach',
    toneColumn: 'audience',
    columns: [
      { key: 'title', label: 'Message', bold: true, value: (r) => r.title || '—' },
      { key: 'audience', label: 'Audience', width: 26, value: (r) => titleCase(r.audience) },
      { key: 'region', label: 'County', width: 26, value: (r) => r.region || 'All counties' },
      { key: 'sent_by', label: 'Sent by', width: 42, value: (r) => r.sent_by || '—' },
      { key: 'recipient_count', label: 'Delivered', align: 'right', width: 24, value: (r) => r.recipient_count ?? 0 },
      { key: 'read_count', label: 'Read', align: 'right', width: 20, value: (r) => r.read_count ?? 0 },
      { key: 'created_at', label: 'Date', width: 26, value: (r) => fmtDate(r.created_at) },
    ],
    summary: (rows) => {
      const delivered = rows.reduce((s, r) => s + Number(r.recipient_count || 0), 0);
      const read = rows.reduce((s, r) => s + Number(r.read_count || 0), 0);
      return [
        { value: rows.length, label: 'Messages sent' },
        { value: delivered, label: 'Total deliveries' },
        { value: read, label: 'Opened' },
        { value: delivered ? `${Math.round((read / delivered) * 100)}%` : '—', label: 'Read rate' },
      ];
    },
  },

  collections: {
    title: 'Community Collection Activity',
    subtitle: 'Material recovered, by waste picker',
    orientation: 'portrait',
    file: 'community-activity',
    columns: [
      { key: 'picker_id', label: 'Picker ID', mono: true, width: 34, value: (r) => r.picker_id || '—' },
      { key: 'full_name', label: 'Name', bold: true, value: (r) => r.full_name || '—' },
      { key: 'region', label: 'County', width: 28, value: (r) => r.region || '—' },
      { key: 'trips', label: 'Records', align: 'right', width: 22, value: (r) => r.trips ?? 0 },
      { key: 'total_kg', label: 'Total (kg)', align: 'right', width: 26, value: (r) => Number(r.total_kg || 0).toFixed(1) },
    ],
    summary: (rows) => {
      const kg = rows.reduce((s, r) => s + Number(r.total_kg || 0), 0);
      return [
        { value: rows.length, label: 'Waste pickers' },
        { value: rows.reduce((s, r) => s + Number(r.trips || 0), 0), label: 'Records' },
        { value: kg.toFixed(1), label: 'Total kilograms' },
        { value: rows.length ? (kg / rows.length).toFixed(1) : '0.0', label: 'Average per picker' },
      ];
    },
  },
};

export default function Reports() {
  const { user } = useAuth();
  const [tab, setTab] = useState('registrations');
  const [regions, setRegions] = useState([]);
  const [filters, setFilters] = useState({ from: '', to: '', region_id: '', status: '' });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const report = REPORTS[tab];

  useEffect(() => {
    api.regions().then((r) => setRegions(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const fetcher =
      tab === 'registrations'
        ? () => api.reportRegistrations(filters)
        : tab === 'by-region'
          ? api.reportByRegion
          : tab === 'communication'
            ? api.reportCommunication
            : api.reportCollections;

    fetcher()
      .then((r) => {
        setRows(r.data);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tab, filters]);

  /** Human-readable description of the filters the figures were drawn under. */
  const filterSummary = () => {
    if (tab !== 'registrations') return 'None — all records';
    const parts = [];
    if (filters.from) parts.push(`From ${fmtDate(filters.from)}`);
    if (filters.to) parts.push(`To ${fmtDate(filters.to)}`);
    if (filters.region_id) {
      parts.push(`County: ${regions.find((r) => String(r.id) === String(filters.region_id))?.name || '—'}`);
    }
    if (filters.status) parts.push(`Status: ${titleCase(filters.status)}`);
    return parts.length ? parts.join('   ·   ') : 'None — all records';
  };

  const downloadPdf = async () => {
    // Loaded on demand so the ~700 KB PDF engine never delays first paint.
    const { buildReportPdf } = await import('../lib/pdf.js');
    buildReportPdf({
      title: report.title,
      subtitle: report.subtitle,
      orientation: report.orientation,
      toneColumn: report.toneColumn,
      columns: report.columns,
      rows,
      summary: report.summary(rows),
      meta: {
        'Generated on': fmtDateTime(),
        'Generated by': `${user?.full_name || 'Administrator'} (${titleCase(user?.role)})`,
        Filters: filterSummary(),
        Records: `${rows.length} row${rows.length === 1 ? '' : 's'}`,
      },
      filename: `${report.file}-${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  };

  const renderCell = (row, col) => {
    if (col.key === 'status') return <span className={`pill ${row.status}`}>{row.status}</span>;
    const v = col.value(row);
    return v === '' || v === null || v === undefined ? '—' : String(v);
  };

  return (
    <>
      {error && <div className="alert error">{error}</div>}

      <div className="card">
        <div className="card-head">
          <div className="row-actions">
            {TABS.map(([key, label]) => (
              <button
                key={key}
                className={`btn sm ${tab === key ? '' : 'ghost'}`}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="row-actions">
            <a
              className="btn ghost"
              href="/docs/waste-picker-system-report.pdf"
              download="Waste Picker System - Detailed System Report.pdf"
            >
              System report
            </a>
            <button className="btn" disabled={!rows.length} onClick={downloadPdf}>
              Download PDF
            </button>
          </div>
        </div>

        {tab === 'registrations' && (
          <div className="card-body" style={{ borderBottom: '1px solid var(--line)' }}>
            <div className="filters">
              <div className="field">
                <label>From</label>
                <input
                  type="date"
                  value={filters.from}
                  onChange={(e) => setFilters({ ...filters, from: e.target.value })}
                />
              </div>
              <div className="field">
                <label>To</label>
                <input
                  type="date"
                  value={filters.to}
                  onChange={(e) => setFilters({ ...filters, to: e.target.value })}
                />
              </div>
              <div className="field">
                <label>County</label>
                <select
                  value={filters.region_id}
                  onChange={(e) => setFilters({ ...filters, region_id: e.target.value })}
                >
                  <option value="">All counties</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                >
                  <option value="">All statuses</option>
                  {['pending', 'approved', 'rejected', 'suspended'].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {report.columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={report.columns.length} className="empty">
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={report.columns.length} className="empty">
                    No data for this report.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={r.id || i}>
                    {report.columns.map((c) => (
                      <td key={c.key} className={c.mono ? 'mono' : ''}>
                        {renderCell(r, c)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="pager">
          <span>{rows.length} row(s)</span>
          <span>Generated {new Date().toLocaleString()}</span>
        </div>
      </div>
    </>
  );
}
