import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../lib/api.js';

const MATERIAL_COLORS = ['#2e7d32', '#0277bd', '#b45309', '#6d4c41', '#7b1fa2', '#00838f', '#546e7a'];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.overview().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="alert error">{error}</div>;
  if (!data) return <div className="loading">Loading dashboard...</div>;

  const monthLabel = (m) => {
    const [y, mo] = m.split('-');
    return new Date(Number(y), Number(mo) - 1).toLocaleString('en', { month: 'short' });
  };

  return (
    <>
      <div className="stat-grid">
        <div className="stat green">
          <div className="label">Registered pickers</div>
          <div className="value">{data.total_pickers}</div>
          <div className="sub">{data.approved} approved</div>
        </div>
        <div className="stat amber">
          <div className="label">Awaiting approval</div>
          <div className="value">{data.pending}</div>
          <div className="sub">In the review queue</div>
        </div>
        <div className="stat blue">
          <div className="label">Messages sent</div>
          <div className="value">{data.announcements}</div>
          <div className="sub">Broadcasts to date</div>
        </div>
        <div className="stat">
          <div className="label">Waste recorded</div>
          <div className="value">{data.total_kg.toLocaleString()}</div>
          <div className="sub">kilograms, all time</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Registrations by region</h2>
              <p>Approved vs pending across the Lake Victoria basin</p>
            </div>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={310}>
              <BarChart data={data.by_region} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8eee9" vertical={false} />
                <XAxis dataKey="region" tick={{ fontSize: 11 }} interval={0} angle={-28} textAnchor="end" height={62} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="approved" name="Approved" fill="#2e7d32" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending" name="Pending" fill="#f0b429" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <h2>Material mix</h2>
              <p>Share of total kilograms collected</p>
            </div>
          </div>
          <div className="card-body">
            {data.by_material.length === 0 ? (
              <div className="empty">No collection activity recorded yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={310}>
                <PieChart>
                  <Pie
                    data={data.by_material}
                    dataKey="kg"
                    nameKey="material"
                    innerRadius={62}
                    outerRadius={104}
                    paddingAngle={2}
                  >
                    {data.by_material.map((_, i) => (
                      <Cell key={i} fill={MATERIAL_COLORS[i % MATERIAL_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `${v} kg`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-head">
          <div>
            <h2>Registration trend</h2>
            <p>New waste pickers joining the platform, last 6 months</p>
          </div>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.trend} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8eee9" vertical={false} />
              <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip labelFormatter={monthLabel} />
              <Line
                type="monotone"
                dataKey="registrations"
                stroke="#2e7d32"
                strokeWidth={2.5}
                dot={{ r: 3.5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
