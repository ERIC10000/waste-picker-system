import { useCallback, useEffect, useState } from 'react';
import { api, exportCsv } from '../lib/api.js';

const MATERIALS = ['plastic', 'paper', 'glass', 'metal', 'e_waste', 'organic', 'other'];

export default function Collections() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ from: '', to: '', material: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.collections(filters);
      setRows(res.data);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const totalKg = rows.reduce((s, r) => s + Number(r.weight_kg), 0);

  return (
    <>
      {error && <div className="alert error">{error}</div>}

      <div className="stat-grid">
        <div className="stat green">
          <div className="label">Records shown</div>
          <div className="value">{rows.length}</div>
        </div>
        <div className="stat blue">
          <div className="label">Total weight</div>
          <div className="value">{totalKg.toFixed(1)}</div>
          <div className="sub">kilograms</div>
        </div>
        <div className="stat amber">
          <div className="label">Average per record</div>
          <div className="value">{rows.length ? (totalKg / rows.length).toFixed(1) : '0.0'}</div>
          <div className="sub">kilograms</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
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
              <label>Material</label>
              <select
                value={filters.material}
                onChange={(e) => setFilters({ ...filters, material: e.target.value })}
              >
                <option value="">All materials</option>
                {MATERIALS.map((m) => (
                  <option key={m} value={m}>
                    {m.replace('_', '-')}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            className="btn ghost"
            onClick={() =>
              exportCsv(
                'collection-activity.csv',
                rows.map((r) => ({
                  date: r.collected_on,
                  picker_id: r.picker?.picker_id || '',
                  name: r.picker?.full_name || '',
                  region: r.picker?.region?.name || '',
                  material: r.material,
                  weight_kg: r.weight_kg,
                }))
              )
            }
            disabled={!rows.length}
          >
            Export CSV
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Picker ID</th>
                <th>Name</th>
                <th>Region</th>
                <th>Material</th>
                <th>Weight</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="empty">
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">
                    No collection activity for this period.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.collected_on}</td>
                    <td className="mono">{r.picker?.picker_id || '—'}</td>
                    <td>{r.picker?.full_name || '—'}</td>
                    <td>{r.picker?.region?.name || '—'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{r.material.replace('_', '-')}</td>
                    <td>{Number(r.weight_kg).toFixed(1)} kg</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
