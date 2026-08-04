/**
 * Creates the first superadmin and (optionally) demo waste pickers so the
 * dashboard has something to show during the project demonstration.
 *
 *   npm run seed
 */
import 'dotenv/config';
import { db } from './lib/supabase.js';
import { normalisePhone, phoneToEmail } from './lib/helpers.js';

const ADMIN_EMAIL = String(process.env.SEED_ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.SEED_ADMIN_PASSWORD || '');
const ADMIN_NAME = process.env.SEED_ADMIN_NAME || 'System Administrator';
const PICKER_PASSWORD = String(process.env.SEED_PICKER_PASSWORD || '');

function validateSeedConfig(includeDemo) {
  const missing = [];
  if (!ADMIN_EMAIL) missing.push('SEED_ADMIN_EMAIL');
  if (!ADMIN_PASSWORD) missing.push('SEED_ADMIN_PASSWORD');
  if (includeDemo && !PICKER_PASSWORD) missing.push('SEED_PICKER_PASSWORD');
  if (missing.length) {
    throw new Error(`Set ${missing.join(', ')} in server/.env before running the seed command.`);
  }
  if (ADMIN_PASSWORD.length < 12 || (includeDemo && PICKER_PASSWORD.length < 12)) {
    throw new Error('Seed passwords must contain at least 12 characters.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ADMIN_EMAIL)) {
    throw new Error('SEED_ADMIN_EMAIL must be a valid email address.');
  }
}

async function removeCreatedAuthUser(userId) {
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) console.error('  could not roll back auth user:', error.message);
}

async function ensureAdmin() {
  const { data: existing, error: lookupError } = await db
    .from('admins')
    .select('id')
    .eq('email', ADMIN_EMAIL)
    .maybeSingle();
  if (lookupError) throw new Error(`Could not look up the seed administrator: ${lookupError.message}`);
  if (existing) {
    console.log(`  admin already exists: ${ADMIN_EMAIL}`);
    return;
  }

  const { data: created, error } = await db.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: ADMIN_NAME, kind: 'admin' },
  });
  if (error) throw new Error(`Could not create the admin auth user: ${error.message}`);

  const { error: insErr } = await db.from('admins').insert({
    id: created.user.id,
    full_name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    role: 'superadmin',
  });
  if (insErr) {
    await removeCreatedAuthUser(created.user.id);
    throw new Error(`Could not create the admin profile: ${insErr.message}`);
  }
  console.log(`  created superadmin ${ADMIN_EMAIL}`);
}

const DEMO = [
  ['Achieng Otieno',   '0712000101', 'Kisumu',   'female', 'Nyalenda'],
  ['Brian Ochieng',    '0712000102', 'Kisumu',   'male',   'Manyatta'],
  ['Caroline Adhiambo','0712000103', 'Siaya',    'female', 'Bondo'],
  ['Dennis Wanjala',   '0712000104', 'Kakamega', 'male',   'Lurambi'],
  ['Everlyne Nafula',  '0712000105', 'Bungoma',  'female', 'Kanduyi'],
  ['Fredrick Omondi',  '0712000106', 'Homa Bay', 'male',   'Mbita'],
  ['Grace Auma',       '0712000107', 'Migori',   'female', 'Suna East'],
  ['Hesbon Barasa',    '0712000108', 'Busia',    'male',   'Nambale'],
];

async function seedPickers() {
  const { data: regions, error: regionsError } = await db.from('regions').select('id,name');
  if (regionsError) throw new Error(`Could not load regions: ${regionsError.message}`);
  const regionByName = Object.fromEntries((regions || []).map((r) => [r.name, r.id]));

  for (const [name, rawPhone, region, gender, sub] of DEMO) {
    const phone = normalisePhone(rawPhone);
    const { data: exists, error: lookupError } = await db
      .from('waste_pickers')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();
    if (lookupError) throw new Error(`Could not look up ${name}: ${lookupError.message}`);
    if (exists) continue;
    if (!regionByName[region]) throw new Error(`Seed region is missing: ${region}`);

    const { data: created, error } = await db.auth.admin.createUser({
      email: phoneToEmail(phone),
      password: PICKER_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: name, phone, kind: 'picker' },
    });
    if (error) throw new Error(`Could not create ${name}: ${error.message}`);

    const { error: profileError } = await db.from('waste_pickers').insert({
      id: created.user.id,
      full_name: name,
      phone,
      gender,
      region_id: regionByName[region],
      sub_location: sub,
      status: 'approved', // trigger assigns the unique picker_id
    });
    if (profileError) {
      await removeCreatedAuthUser(created.user.id);
      throw new Error(`Could not create the profile for ${name}: ${profileError.message}`);
    }
    console.log(`  created picker ${name} (${phone})`);
  }

  // leave two registrations pending so the approval queue is demonstrable
  const pending = [
    ['Irene Wekesa', '0712000109', 'Vihiga', 'female', 'Mbale'],
    ['Joseph Kiprop', '0712000110', 'Nandi', 'male', 'Kapsabet'],
  ];
  for (const [name, rawPhone, region, gender, sub] of pending) {
    const phone = normalisePhone(rawPhone);
    const { data: exists, error: lookupError } = await db
      .from('waste_pickers')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();
    if (lookupError) throw new Error(`Could not look up ${name}: ${lookupError.message}`);
    if (exists) continue;
    if (!regionByName[region]) throw new Error(`Seed region is missing: ${region}`);
    const { data: created, error } = await db.auth.admin.createUser({
      email: phoneToEmail(phone),
      password: PICKER_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: name, phone, kind: 'picker' },
    });
    if (error) throw new Error(`Could not create ${name}: ${error.message}`);
    const { error: profileError } = await db.from('waste_pickers').insert({
      id: created.user.id,
      full_name: name,
      phone,
      gender,
      region_id: regionByName[region],
      sub_location: sub,
    });
    if (profileError) {
      await removeCreatedAuthUser(created.user.id);
      throw new Error(`Could not create the profile for ${name}: ${profileError.message}`);
    }
    console.log(`  created PENDING picker ${name} (${phone})`);
  }
}

async function seedCollections() {
  const { data: pickers, error: pickersError } = await db
    .from('waste_pickers')
    .select('id')
    .eq('status', 'approved')
    .limit(20);
  if (pickersError) throw new Error(`Could not load approved pickers: ${pickersError.message}`);
  if (!pickers?.length) return;

  const { count, error: countError } = await db
    .from('collections')
    .select('id', { count: 'exact', head: true });
  if (countError) throw new Error(`Could not inspect collections: ${countError.message}`);
  if (count && count > 0) {
    console.log('  collections already seeded');
    return;
  }

  const materials = ['plastic', 'paper', 'glass', 'metal', 'e_waste', 'organic'];
  const rows = [];
  for (const p of pickers) {
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setDate(d.getDate() - Math.floor(Math.random() * 90));
      rows.push({
        picker_id: p.id,
        material: materials[Math.floor(Math.random() * materials.length)],
        weight_kg: Number((Math.random() * 40 + 5).toFixed(2)),
        collected_on: d.toISOString().slice(0, 10),
      });
    }
  }
  const { error } = await db.from('collections').insert(rows);
  if (error) throw new Error(`Could not create collection records: ${error.message}`);
  console.log(`  created ${rows.length} collection records`);
}

(async () => {
  const includeDemo = process.argv.includes('--demo') || process.env.SEED_DEMO === 'true';
  validateSeedConfig(includeDemo);
  console.log('\nSeeding Waste Picker System...\n');
  await ensureAdmin();
  if (includeDemo) {
    await seedPickers();
    await seedCollections();
  } else {
    console.log('\n  (run "npm run seed -- --demo" to also create demo pickers & activity)');
  }
  console.log('\nDone.\n');
})().catch((error) => {
  console.error(`\nSeed failed: ${error.message}\n`);
  process.exitCode = 1;
});
