import { Router } from 'express';
import { db } from '../lib/supabase.js';
import { ah, ApiError } from '../lib/helpers.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(authenticate, requireAdmin);

/* GET /api/reports/overview - dashboard headline numbers */
router.get(
  '/overview',
  ah(async (_req, res) => {
    const count = async (build) => {
      const { count: c, error } = await build(
        db.from('waste_pickers').select('id', { count: 'exact', head: true })
      );
      if (error) throw new ApiError(400, error.message);
      return c ?? 0;
    };

    const [total, approved, pending, suspended] = await Promise.all([
      count((q) => q),
      count((q) => q.eq('status', 'approved')),
      count((q) => q.eq('status', 'pending')),
      count((q) => q.eq('status', 'suspended')),
    ]);

    const { count: announcements } = await db
      .from('announcements')
      .select('id', { count: 'exact', head: true });

    const { data: byRegion } = await db.from('v_registrations_by_region').select('*');

    const { data: weights } = await db.from('collections').select('weight_kg, material');
    const totalKg = (weights || []).reduce((s, c) => s + Number(c.weight_kg), 0);

    const byMaterial = Object.entries(
      (weights || []).reduce((acc, c) => {
        acc[c.material] = (acc[c.material] || 0) + Number(c.weight_kg);
        return acc;
      }, {})
    ).map(([material, kg]) => ({ material, kg: Number(kg.toFixed(2)) }));

    // registrations over the last 6 months
    const since = new Date();
    since.setMonth(since.getMonth() - 5);
    since.setDate(1);
    const { data: recent } = await db
      .from('waste_pickers')
      .select('created_at')
      .gte('created_at', since.toISOString());

    const trendMap = {};
    for (let i = 0; i < 6; i++) {
      const d = new Date(since);
      d.setMonth(since.getMonth() + i);
      trendMap[d.toISOString().slice(0, 7)] = 0;
    }
    for (const r of recent || []) {
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
      suspended,
      announcements: announcements ?? 0,
      total_kg: Number(totalKg.toFixed(2)),
      by_region: byRegion || [],
      by_material: byMaterial,
      trend,
    });
  })
);

/* GET /api/reports/registrations */
router.get(
  '/registrations',
  ah(async (req, res) => {
    let q = db
      .from('waste_pickers')
      .select('picker_id, full_name, phone, gender, status, role, created_at, region:regions(name)')
      .order('created_at', { ascending: false });

    if (req.query.from) q = q.gte('created_at', req.query.from);
    if (req.query.to) q = q.lte('created_at', `${req.query.to}T23:59:59`);
    if (req.query.region_id) q = q.eq('region_id', Number(req.query.region_id));
    if (req.query.status) q = q.eq('status', req.query.status);

    const { data, error } = await q.limit(2000);
    if (error) throw new ApiError(400, error.message);

    res.json({
      data: (data || []).map((r) => ({ ...r, region: r.region?.name || '-' })),
    });
  })
);

/* GET /api/reports/by-region */
router.get(
  '/by-region',
  ah(async (_req, res) => {
    const { data, error } = await db.from('v_registrations_by_region').select('*');
    if (error) throw new ApiError(400, error.message);
    res.json({ data });
  })
);

/* GET /api/reports/communication */
router.get(
  '/communication',
  ah(async (_req, res) => {
    const { data, error } = await db
      .from('v_communication_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw new ApiError(400, error.message);
    res.json({ data });
  })
);

/* GET /api/reports/collections */
router.get(
  '/collections',
  ah(async (_req, res) => {
    const { data, error } = await db
      .from('v_collection_summary')
      .select('*')
      .order('total_kg', { ascending: false })
      .limit(500);
    if (error) throw new ApiError(400, error.message);
    res.json({ data });
  })
);

export default router;
