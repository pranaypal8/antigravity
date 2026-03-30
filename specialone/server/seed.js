// ============================================================
// SEED SCRIPT — Creates the first Super Admin account
// ============================================================
// Run this ONCE with: npm run seed
// This creates the initial admin user so you can log in.
// After running, log in and change the password immediately.
// ============================================================

require('dotenv').config({ path: __dirname + '/.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const connectDB = require('./config/db');
const AdminUser = require('./models/AdminUser');

const seedAdmin = async () => {
  console.log('🌱 Starting seed process...');

  // Connect to the database
  await connectDB();

  // Wait a moment for connection to stabilize
  await new Promise(r => setTimeout(r, 2000));

  const email = process.env.SEED_ADMIN_EMAIL || 'specialonepranay@gmail.com';
  const password = process.env.SEED_ADMIN_PASSWORD || 'SpecialOne@2024!';

  // Check if the super admin already exists
  const existing = await AdminUser.findOne({ email });
  if (existing) {
    console.log(`⚠️  Admin user ${email} already exists. Skipping seed.`);
    console.log('   If you need to reset the password, use the admin settings panel.');
    process.exit(0);
  }

  // Hash the password securely (12 rounds = strong but not too slow)
  const hashedPassword = await bcrypt.hash(password, 12);

  // Create the Super Admin account
  const admin = await AdminUser.create({
    name: 'Pranay',
    email,
    password: hashedPassword,
    role: 'superadmin',
    isActive: true,
  });

  console.log(`
  ✅ Super Admin created successfully!
  ─────────────────────────────────────
  Name:     ${admin.name}
  Email:    ${admin.email}
  Role:     ${admin.role}
  ─────────────────────────────────────
  ⚠️  IMPORTANT: Log in and change your password immediately!
  Admin panel: http://localhost:${process.env.PORT || 5000}/admin/login.html
  `);

  // Also create accounts for Shreyansh and Kunal (placeholder emails)
  const otherAdmins = [
    { name: 'Shreyansh', email: 'shreyansh@specialone.in', role: 'superadmin' },
    { name: 'Kunal',     email: 'kunal@specialone.in',     role: 'superadmin' },
  ];

  for (const a of otherAdmins) {
    const existsOther = await AdminUser.findOne({ email: a.email });
    if (!existsOther) {
      const hp = await bcrypt.hash(password, 12);
      await AdminUser.create({ ...a, password: hp, isActive: true });
      console.log(`✅ Created admin: ${a.name} (${a.email})`);
    }
  }

  console.log('\n🎉 Seed complete. You can now log in to the admin panel.');
  process.exit(0);
};

seedAdmin().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
