import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const STATUSES = ['pending', 'approved', 'rejected', 'suspended'];
const ROLES = [
  ['picker', 'Waste Picker'],
  ['community_leader', 'Community Leader'],
  ['data_collector', 'Data Collector'],
];

export default function Pickers() {
  const [rows, setRows] = useState([]);
  const [regions, setRegions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: '', region_id: '', q: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState(null);

  const limit = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.pickers({ ...filters, page, limit });
      setRows(res.data);
      setTotal(res.total);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    api.regions().then((r) => setRegions(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id, fn, message) => {
    try {
      await fn();
      setNotice(message);
      setTimeout(() => setNotice(''), 3000);
      load();
      if (selected?.id === id) setSelected(null);
    } catch (e) {
      setError(e.message);
    }
  };

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <>
      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert ok">{notice}</div>}

      <div className="card">
        <div className="card-head">
          <div className="filters">
            <div className="field">
              <label>Search</label>
              <input
                placeholder="Name, phone or ID"
                value={filters.q}
                onChange={(e) => {
                  setPage(1);
                  setFilters({ ...filters, q: e.target.value });
                }}
              />
            </div>
            <div className="field">
              <label>Status</label>
              <select
                value={filters.status}
                onChange={(e) => {
                  setPage(1);
                  setFilters({ ...filters, status: e.target.value });
                }}
              >
                <option value="">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s[0].toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Region</label>
              <select
                value={filters.region_id}
                onChange={(e) => {
                  setPage(1);
                  setFilters({ ...filters, region_id: e.target.value });
                }}
              >
                <option value="">All regions</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>{total} record(s)</div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Picker ID</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Region</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="empty">
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty">
                    No waste pickers match these filters.
                  </td>
                </tr>
              ) : (
                rows.map((p) => (
                  <tr key={p.id}>
                    <td className="mono">{p.picker_id || '—'}</td>
                    <td>
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          api.picker(p.id).then(setSelected).catch((err) => setError(err.message));
                        }}
                        style={{ fontWeight: 600, color: 'var(--green-700)' }}
                      >
                        {p.full_name}
                      </a>
                    </td>
                    <td className="mono">{p.phone}</td>
                    <td>{p.region?.name || '—'}</td>
                    <td>{ROLES.find((r) => r[0] === p.role)?.[1] || p.role}</td>
                    <td>
                      <span className={`pill ${p.status}`}>{p.status}</span>
                    </td>
                    <td>
                      <div className="row-actions">
                        {p.status !== 'approved' && (
                          <button
                            className="btn sm"
                            onClick={() =>
                              act(p.id, () => api.setStatus(p.id, 'approved'), `${p.full_name} approved — unique ID issued`)
                            }
                          >
                            Approve
                          </button>
                        )}
                        {p.status === 'pending' && (
                          <button
                            className="btn sm ghost"
                            onClick={() => act(p.id, () => api.setStatus(p.id, 'rejected'), 'Registration rejected')}
                          >
                            Reject
                          </button>
                        )}
                        {p.status === 'approved' && (
                          <button
                            className="btn sm ghost"
                            onClick={() => act(p.id, () => api.setStatus(p.id, 'suspended'), 'Account suspended')}
                          >
                            Suspend
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="pager">
          <span>
            Page {page} of {pages}
          </span>
          <div className="row-actions">
            <button className="btn sm ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <button className="btn sm ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        </div>
      </div>

      {selected && (
        <PickerDrawer
          picker={selected}
          onClose={() => setSelected(null)}
          onAction={act}
          reload={load}
        />
      )}
    </>
  );
}

function PickerDrawer({ picker, onClose, onAction, reload }) {
  const [role, setRole] = useState(picker.role);

  const totalKg = (picker.collections || []).reduce((s, c) => s + Number(c.weight_kg), 0);

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>{picker.full_name}</h2>
          <button className="btn sm ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-body">
            <div className="kv">
              <span>Waste Picker ID</span>
              <span className="mono">{picker.picker_id || 'Not yet issued'}</span>
            </div>
            <div className="kv">
              <span>Status</span>
              <span>
                <span className={`pill ${picker.status}`}>{picker.status}</span>
              </span>
            </div>
            <div className="kv">
              <span>Phone</span>
              <span className="mono">{picker.phone}</span>
            </div>
            <div className="kv">
              <span>National ID</span>
              <span>{picker.national_id || '—'}</span>
            </div>
            <div className="kv">
              <span>Gender</span>
              <span style={{ textTransform: 'capitalize' }}>{picker.gender || '—'}</span>
            </div>
            <div className="kv">
              <span>Region</span>
              <span>{picker.region?.name || '—'}</span>
            </div>
            <div className="kv">
              <span>Sub-location</span>
              <span>{picker.sub_location || '—'}</span>
            </div>
            <div className="kv">
              <span>Registered</span>
              <span>{new Date(picker.created_at).toLocaleDateString()}</span>
            </div>
            <div className="kv">
              <span>Total collected</span>
              <span>{totalKg.toFixed(1)} kg</span>
            </div>
          </div>
        </div>

        <div className="section-title">Assign role</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            className="btn"
            disabled={role === picker.role}
            onClick={() => onAction(picker.id, () => api.setRole(picker.id, role), 'Role updated')}
          >
            Save
          </button>
        </div>

        <div className="section-title">Recent collections</div>
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Material</th>
                  <th>Weight</th>
                </tr>
              </thead>
              <tbody>
                {(picker.collections || []).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="empty">
                      No activity recorded.
                    </td>
                  </tr>
                ) : (
                  picker.collections.map((c) => (
                    <tr key={c.id}>
                      <td>{c.collected_on}</td>
                      <td style={{ textTransform: 'capitalize' }}>{c.material.replace('_', '-')}</td>
                      <td>{Number(c.weight_kg).toFixed(1)} kg</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="section-title">Danger zone</div>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm(`Permanently delete ${picker.full_name}? This cannot be undone.`)) {
              onAction(picker.id, () => api.deletePicker(picker.id), 'Record deleted').then(reload);
            }
          }}
        >
          Delete this record
        </button>
      </div>
    </div>
  );
}
