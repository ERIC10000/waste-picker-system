import { Router } from 'express';
import { db } from '../lib/supabase.js';
import { ah, ApiError } from '../lib/helpers.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(authenticate, requireAdmin);

function reportQueryFailed(error) {
  console.error('Reporting query failed:', error);
  throw new ApiError(502, 'Reporting data is temporarily unavailable');
}

/** Fetch every row without relying on the project's PostgREST response cap. */
async function fetchAllRows(buildQuery, pageSize = 500) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) reportQueryFailed(error);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}

/* GET /api/reports/overview - dashboard headline numbers */
router.get(
  '/overview',
  ah(async (_req, res) => {
    const count = async (build) => {
      const { count: c, error } = await build(
        db.from('waste_pickers').select('id', { count: 'exact', head: true })
      );
      if (error) reportQueryFailed(error);
      return c ?? 0;
    };

    const [total, approved, pending, rejected, suspended] = await Promise.all([
      count((q) => q),
      count((q) => q.eq('status', 'approved')),
      count((q) => q.eq('status', 'pending')),
      count((q) => q.eq('status', 'rejected')),
      count((q) => q.eq('status', 'suspended')),
    ]);

    const { count: announcements, error: announcementsError } = await db
      .from('announcements')
      .select('id', { count: 'exact', head: true });
    if (announcementsError) reportQueryFailed(announcementsError);

    const { data: byRegion, error: byRegionError } = await db
      .from('v_registrations_by_region')
      .select('*');
    if (byRegionError) reportQueryFailed(byRegionError);

    const weights = await fetchAllRows(() =>
      db.from('collections').select('id, weight_kg, material').order('id', { ascending: true })
    );
    const totalKg = weights.reduce((sum, collection) => {
      const weight = Number(collection.weight_kg);
      return Number.isFinite(weight) ? sum + weight : sum;
    }, 0);

    const byMaterial = Object.entries(
      weights.reduce((acc, collection) => {
        const material = collection.material || 'other';
        const weight = Number(collection.weight_kg);
        acc[material] = (acc[material] || 0) + (Number.isFinite(weight) ? weight : 0);
        return acc;
      }, {})
    )
      .map(([material, kg]) => ({ material, kg: Number(kg.toFixed(2)) }))
      .sort((a, b) => b.kg - a.kg);

    // registrations over the last 6 months
    const now = new Date();
    const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    const recent = await fetchAllRows(() =>
      db
        .from('waste_pickers')
        .select('id, created_at')
        .gte('created_at', since.toISOString())
        .order('id', { ascending: true })
    );

    const trendMap = {};
    for (let i = 0; i < 6; i++) {
      const d = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth() + i, 1));
      trendMap[d.toISOString().slice(0, 7)] = 0;
    }
    for (const r of recent) {
      const k = String(r.created_at).slice(0, 7);
      if (k in trendMap) trendMap[k] += 1;
    }
    const trend = Object.entries(trendMap).map(([month, registrations]) => ({
      month,
      registrations,
    }));

    res.json({
      total_pickers: total,
      approved,
      pending,
      rejected,
      suspended,
      announcements: announcements ?? 0,
      total_kg: Number(totalKg.toFixed(2)),
      by_region: byRegion || [],
      by_material: byMaterial,
      trend,
      generated_at: new Date().toISOString(),
    });
  })
);

/* GET /api/reports/registrations */
router.get(
  '/registrations',
  ah(async (req, res) => {
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (req.query.from && !datePattern.test(req.query.from)) {
      throw new ApiError(400, 'The from date must use YYYY-MM-DD');
    }
    if (req.query.to && !datePattern.test(req.query.to)) {
      throw new ApiError(400, 'The to date must use YYYY-MM-DD');
    }
    const regionId = req.query.region_id ? Number(req.query.region_id) : null;
    if (regionId !== null && (!Number.isInteger(regionId) || regionId < 1)) {
      throw new ApiError(400, 'region_id must be a positive integer');
    }
    const validStatuses = new Set(['pending', 'approved', 'rejected', 'suspended']);
    if (req.query.status && !validStatuses.has(req.query.status)) {
      throw new ApiError(400, 'Unknown registration status');
    }

    const buildQuery = () => {
      let query = db
        .from('waste_pickers')
        .select(
          'id, picker_id, full_name, phone, gender, status, role, created_at, region:regions(name)'
        )
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });

      if (req.query.from) query = query.gte('created_at', req.query.from);
      if (req.query.to) query = query.lte('created_at', `${req.query.to}T23:59:59.999Z`);
      if (regionId !== null) query = query.eq('region_id', regionId);
      if (req.query.status) query = query.eq('status', req.query.status);
      return query;
    };

    const data = await fetchAllRows(buildQuery);

    res.json({
      data: data.map((r) => ({ ...r, region: r.region?.name || '-' })),
    });
  })
);

/* GET /api/reports/by-region */
router.get(
  '/by-region',
  ah(async (_req, res) => {
    const { data, error } = await db.from('v_registrations_by_region').select('*');
    if (error) reportQueryFailed(error);
    res.json({ data });
  })
);

/* GET /api/reports/communication */
router.get(
  '/communication',
  ah(async (_req, res) => {
    const data = await fetchAllRows(() =>
      db
        .from('v_communication_log')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
    );
    res.json({ data });
  })
);

/* GET /api/reports/collections */
router.get(
  '/collections',
  ah(async (_req, res) => {
    const data = await fetchAllRows(() =>
      db
        .from('v_collection_summary')
        .select('*')
        .order('total_kg', { ascending: false })
        .order('picker_uuid', { ascending: true })
    );
    res.json({ data });
  })
);

export default router;
