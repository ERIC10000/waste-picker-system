import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

export default function Announcements() {
  const [log, setLog] = useState([]);
  const [regions, setRegions] = useState([]);
  const [pickers, setPickers] = useState([]);
  const [form, setForm] = useState({
    title: '',
    body: '',
    audience: 'all',
    region_id: '',
    recipient_id: '',
    is_urgent: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = () => api.announcements().then((r) => setLog(r.data)).catch((e) => setError(e.message));

  useEffect(() => {
    load();
    api.regions().then((r) => setRegions(r.data)).catch(() => {});
    api
      .pickers({ status: 'approved', limit: 100 })
      .then((r) => setPickers(r.data))
      .catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api.broadcast({
        ...form,
        region_id: form.audience === 'region' ? Number(form.region_id) : undefined,
        recipient_id: form.audience === 'individual' ? form.recipient_id : undefined,
      });
      setNotice(`Message sent to ${res.delivered_to} waste picker(s).`);
      setTimeout(() => setNotice(''), 4000);
      setForm({ title: '', body: '', audience: 'all', region_id: '', recipient_id: '', is_urgent: false });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert ok">{notice}</div>}

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Communication log</h2>
              <p>Every broadcast, who received it and how many opened it</p>
            </div>
            <button className="btn sm ghost" onClick={load}>
              Refresh
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Audience</th>
                  <th>Sent</th>
                  <th>Delivered</th>
                  <th>Read</th>
                </tr>
              </thead>
              <tbody>
                {log.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty">
                      No messages sent yet.
                    </td>
                  </tr>
                ) : (
                  log.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{a.title}</div>
                        {a.is_urgent && <span className="pill urgent">Urgent</span>}
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>
                        {a.audience === 'region' ? a.region || 'Region' : a.audience}
                      </td>
                      <td>{new Date(a.created_at).toLocaleDateString()}</td>
                      <td>{a.recipient_count}</td>
                      <td>{a.read_count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <h2>Compose a message</h2>
              <p>Delivered to the mobile app inbox of every recipient</p>
            </div>
          </div>
          <form className="card-body" onSubmit={submit}>
            <div className="field">
              <label>Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Free health screening this Saturday"
                required
              />
            </div>

            <div className="field">
              <label>Message</label>
              <textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Write the full announcement here..."
                required
              />
            </div>

            <div className="field">
              <label>Send to</label>
              <select
                value={form.audience}
                onChange={(e) => setForm({ ...form, audience: e.target.value })}
              >
                <option value="all">Everyone (all approved pickers)</option>
                <option value="region">A specific region</option>
                <option value="individual">One waste picker</option>
              </select>
            </div>

            {form.audience === 'region' && (
              <div className="field">
                <label>Region</label>
                <select
                  value={form.region_id}
                  onChange={(e) => setForm({ ...form, region_id: e.target.value })}
                  required
                >
                  <option value="">Select a region</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {form.audience === 'individual' && (
              <div className="field">
                <label>Waste picker</label>
                <select
                  value={form.recipient_id}
                  onChange={(e) => setForm({ ...form, recipient_id: e.target.value })}
                  required
                >
                  <option value="">Select a waste picker</option>
                  {pickers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} — {p.picker_id || p.phone}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={form.is_urgent}
                onChange={(e) => setForm({ ...form, is_urgent: e.target.checked })}
              />
              Mark as urgent (health alert, emergency)
            </label>

            <button className="btn" style={{ width: '100%' }} disabled={busy}>
              {busy ? 'Sending...' : 'Send message'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
