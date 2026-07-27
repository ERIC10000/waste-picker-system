import { useEffect, useState } from 'react';
import { api, exportCsv } from '../lib/api.js';

const TABS = [
  ['registrations', 'Registrations'],
  ['by-region', 'By region'],
  ['communication', 'Communication reach'],
  ['collections', 'Community activity'],
];

export default function Reports() {
  const [tab, setTab] = useState('registrations');
  const [regions, setRegions] = useState([]);
  const [filters, setFilters] = useState({ from: '', to: '', region_id: '', status: '' });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const columns = {
    registrations: [
      ['picker_id', 'Picker ID'],
      ['full_name', 'Name'],
      ['phone', 'Phone'],
      ['gender', 'Gender'],
      ['region', 'Region'],
      ['status', 'Status'],
      ['role', 'Role'],
      ['created_at', 'Registered'],
    ],
    'by-region': [
      ['region', 'Region'],
      ['total', 'Total'],
      ['approved', 'Approved'],
      ['pending', 'Pending'],
      ['rejected', 'Rejected'],
      ['suspended', 'Suspended'],
    ],
    communication: [
      ['title', 'Message'],
      ['audience', 'Audience'],
      ['region', 'Region'],
      ['sent_by', 'Sent by'],
      ['recipient_count', 'Delivered'],
      ['read_count', 'Read'],
      ['created_at', 'Date'],
    ],
    collections: [
      ['picker_id', 'Picker ID'],
      ['full_name', 'Name'],
      ['region', 'Region'],
      ['trips', 'Records'],
      ['total_kg', 'Total kg'],
    ],
  }[tab];

  const render = (row, key) => {
    const v = row[key];
    if (v === null || v === undefined || v === '') return '—';
    if (key === 'created_at') return new Date(v).toLocaleDateString();
    if (key === 'status' || key === 'role' || key === 'gender' || key === 'audience')
      return String(v).replace('_', ' ');
    return String(v);
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
          <button
            className="btn ghost"
            disabled={!rows.length}
            onClick={() =>
              exportCsv(
                `${tab}-report.csv`,
                rows.map((r) =>
                  Object.fromEntries(columns.map(([k]) => [k, r[k] ?? '']))
                )
              )
            }
          >
            Export CSV
          </button>
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
                <label>Region</label>
                <select
                  value={filters.region_id}
                  onChange={(e) => setFilters({ ...filters, region_id: e.target.value })}
                >
                  <option value="">All regions</option>
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
                {columns.map(([key, label]) => (
                  <th key={key}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="empty">
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="empty">
                    No data for this report.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={r.id || i}>
                    {columns.map(([key]) => (
                      <td
                        key={key}
                        className={key === 'picker_id' || key === 'phone' ? 'mono' : ''}
                        style={
                          ['status', 'role', 'gender', 'audience'].includes(key)
                            ? { textTransform: 'capitalize' }
                            : undefined
                        }
                      >
                        {key === 'status' ? (
                          <span className={`pill ${r[key]}`}>{r[key]}</span>
                        ) : (
                          render(r, key)
                        )}
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
