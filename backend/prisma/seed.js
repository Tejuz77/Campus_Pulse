require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // ── DEPARTMENTS ─────────────────────────────────────────────────────────────
  const deptData = [
    // Academic
    { name: 'CSE', type: 'academic' },
    { name: 'IT', type: 'academic' },
    { name: 'ECE', type: 'academic' },
    { name: 'CSE (Cyber Security)', type: 'academic' },
    { name: 'AIML', type: 'academic' },
    { name: 'AIDS', type: 'academic' },
    { name: 'EEE', type: 'academic' },
    { name: 'Mechanical', type: 'academic' },
    { name: 'Civil', type: 'academic' },
    // Service
    { name: 'Maintenance & Infrastructure', type: 'service' },
    { name: 'Water & Sanitation', type: 'service' },
    { name: 'Electrical', type: 'service' },
    { name: 'IT/Network', type: 'service' },
  ];

  const departments = {};
  for (const d of deptData) {
    const dept = await prisma.department.upsert({
      where: { name: d.name },
      update: {},
      create: d,
    });
    departments[d.name] = dept;
  }
  console.log('✅ Departments seeded:', Object.keys(departments).length);

  // ── CATEGORIES ───────────────────────────────────────────────────────────────
  const categoryData = [
    {
      name: 'Classroom Infrastructure',
      defaultDepartmentId: departments['Maintenance & Infrastructure'].id,
      isDepartmentOwned: false,
      defaultPriority: 'MEDIUM',
      isSafety: false,
    },
    {
      name: 'Furniture',
      defaultDepartmentId: departments['Maintenance & Infrastructure'].id,
      isDepartmentOwned: false,
      defaultPriority: 'LOW',
      isSafety: false,
    },
    {
      name: 'Fan/Light',
      defaultDepartmentId: departments['Electrical'].id,
      isDepartmentOwned: false,
      defaultPriority: 'MEDIUM',
      isSafety: false,
    },
    {
      name: 'Drinking Water',
      defaultDepartmentId: departments['Water & Sanitation'].id,
      isDepartmentOwned: false,
      defaultPriority: 'HIGH',
      isSafety: false,
    },
    {
      name: 'Sanitation/Washroom',
      defaultDepartmentId: departments['Water & Sanitation'].id,
      isDepartmentOwned: false,
      defaultPriority: 'HIGH',
      isSafety: false,
    },
    {
      name: 'Electrical/Safety',
      defaultDepartmentId: departments['Electrical'].id,
      isDepartmentOwned: false,
      defaultPriority: 'CRITICAL',
      isSafety: true,
    },
    {
      name: 'Wi-Fi/Network',
      defaultDepartmentId: departments['IT/Network'].id,
      isDepartmentOwned: false,
      defaultPriority: 'MEDIUM',
      isSafety: false,
    },
    {
      name: 'Lab Computer/System',
      defaultDepartmentId: null,
      isDepartmentOwned: true,
      defaultPriority: 'MEDIUM',
      isSafety: false,
    },
    {
      name: 'Lab Equipment',
      defaultDepartmentId: null,
      isDepartmentOwned: true,
      defaultPriority: 'MEDIUM',
      isSafety: false,
    },
    {
      name: 'Other',
      defaultDepartmentId: null,
      isDepartmentOwned: false,
      defaultPriority: 'LOW',
      isSafety: false,
    },
  ];

  const categories = {};
  for (const c of categoryData) {
    const cat = await prisma.category.upsert({
      where: { name: c.name },
      update: {},
      create: c,
    });
    categories[c.name] = cat;
  }
  console.log('✅ Categories seeded:', Object.keys(categories).length);

  // ── LOCATIONS ────────────────────────────────────────────────────────────────
  const locationData = [];

  // Blocks A, B, C, D — classrooms
  for (const block of ['A', 'B', 'C', 'D']) {
    for (let floor = 1; floor <= 3; floor++) {
      for (let room = 1; room <= 10; room++) {
        const roomNum = floor * 100 + room;
        locationData.push({
          block,
          floor,
          name: `Room ${roomNum}`,
          type: 'classroom',
        });
      }
    }
  }

  // Jewel Labs
  const jewelLabs = [
    'Cyber Space-1',
    'Cyber Space-2',
    'Cyber Sheper-1',
    'Cyber Sheper-2',
    'Cyber Craft-1',
    'Cyber Craft-2',
  ];
  for (const lab of jewelLabs) {
    locationData.push({ block: 'Jewel', floor: null, name: lab, type: 'lab', systemCount: 34 });
  }

  // Block C labs
  locationData.push({ block: 'C', floor: null, name: 'C Lab-1', type: 'lab', systemCount: 34 });
  locationData.push({ block: 'C', floor: null, name: 'C Lab-2', type: 'lab', systemCount: 34 });

  // Block D labs
  locationData.push({ block: 'D', floor: null, name: 'D Lab-1', type: 'lab', systemCount: 34 });
  locationData.push({ block: 'D', floor: null, name: 'D Lab-2', type: 'lab', systemCount: 34 });

  // Washrooms per block
  for (const block of ['A', 'B', 'C', 'D']) {
    locationData.push({ block, floor: 1, name: `${block} Block Washroom Floor 1`, type: 'washroom' });
    locationData.push({ block, floor: 2, name: `${block} Block Washroom Floor 2`, type: 'washroom' });
    locationData.push({ block, floor: 3, name: `${block} Block Washroom Floor 3`, type: 'washroom' });
  }

  // Drinking water points per block
  for (const block of ['A', 'B', 'C', 'D']) {
    locationData.push({ block, floor: 1, name: `${block} Block Water Point Floor 1`, type: 'other' });
    locationData.push({ block, floor: 2, name: `${block} Block Water Point Floor 2`, type: 'other' });
  }

  // Corridors
  for (const block of ['A', 'B', 'C', 'D']) {
    for (let floor = 1; floor <= 3; floor++) {
      locationData.push({ block, floor, name: `${block} Block Corridor Floor ${floor}`, type: 'corridor' });
    }
  }

  for (const loc of locationData) {
    const existing = await prisma.location.findFirst({
      where: { name: loc.name, block: loc.block || null },
    });
    if (!existing) {
      await prisma.location.create({ data: { ...loc, status: 'approved' } });
    }
  }
  console.log('✅ Locations seeded');

  // ── ADMIN ────────────────────────────────────────────────────────────────────
  const adminPassword = await argon2.hash('Admin@12345');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@svecw.edu.in' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@svecw.edu.in',
      passwordHash: adminPassword,
      role: 'ADMIN',
      isActive: true,
    },
  });
  console.log('✅ Admin seeded: admin@svecw.edu.in / Admin@12345');

  // ── STAFF (2 per department) ─────────────────────────────────────────────────
  const STAFF_PASSWORD = 'Staff@12345';
  const staffHash = await argon2.hash(STAFF_PASSWORD);
  const staffCredentials = [];

  for (const [deptName, dept] of Object.entries(departments)) {
    for (let i = 1; i <= 2; i++) {
      const shortName = deptName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 6);
      const email = `staff.${shortName}${i}@svecw.edu.in`;

      await prisma.user.upsert({
        where: { email },
        update: { passwordHash: staffHash, isActive: true, departmentId: dept.id },
        create: {
          name: `${deptName} Staff ${i}`,
          email,
          passwordHash: staffHash,
          role: 'STAFF',
          departmentId: dept.id,
          isActive: true,
        },
      });

      staffCredentials.push({ email, password: STAFF_PASSWORD, department: deptName });
    }
  }
  console.log('✅ Staff seeded:', staffCredentials.length, 'accounts (password: Staff@12345)');

  // ── DEMO STUDENTS ────────────────────────────────────────────────────────────
  const studentData = [
    { name: 'Priya Sharma', email: '25b05a1201@svecw.edu.in', rollNo: '25b05a1201' },
    { name: 'Divya Reddy',  email: '25b05a1202@svecw.edu.in', rollNo: '25b05a1202' },
    { name: 'Anusha Rao',   email: '25b05a1203@svecw.edu.in', rollNo: '25b05a1203' },
  ];

  for (const s of studentData) {
    const hash = await argon2.hash('Student@123');
    await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        name: s.name,
        email: s.email,
        passwordHash: hash,
        role: 'STUDENT',
        rollNo: s.rollNo,
        isActive: true,
      },
    });
  }
  console.log('✅ Demo students seeded (password: Student@123)');

  // ── DEFAULT SETTINGS ─────────────────────────────────────────────────────────
  const defaultSettings = [
    { key: 'CONFIRM_WINDOW_HOURS', value: '72' },
    { key: 'REOPEN_WINDOW_DAYS', value: '7' },
    { key: 'REPORTS_PER_HOUR', value: '5' },
    { key: 'MAX_PENDING_PROPOSALS', value: '3' },
    { key: 'ESCALATION_CRITICAL_RESPONSE_H', value: '1' },
    { key: 'ESCALATION_CRITICAL_RESOLUTION_H', value: '24' },
    { key: 'ESCALATION_HIGH_RESPONSE_H', value: '4' },
    { key: 'ESCALATION_HIGH_RESOLUTION_H', value: '48' },
    { key: 'ESCALATION_MEDIUM_RESPONSE_H', value: '24' },
    { key: 'ESCALATION_MEDIUM_RESOLUTION_H', value: '120' },
    { key: 'ESCALATION_LOW_RESPONSE_H', value: '48' },
    { key: 'ESCALATION_LOW_RESOLUTION_H', value: '240' },
    {
      key: 'SAFETY_BANNER',
      value:
        'CampusPulse is NOT an emergency service. For immediate danger contact college security/emergency personnel now.',
    },
    { key: 'STUDENT_EMAIL_PATTERN', value: '^[a-z0-9]{10}@svecw\\.edu\\.in$' },
  ];

  for (const s of defaultSettings) {
    await prisma.settings.upsert({ where: { key: s.key }, update: {}, create: s });
  }
  console.log('✅ Default settings seeded');

  // Print staff credentials
  console.log('\n📋 STAFF CREDENTIALS:');
  for (const s of staffCredentials) {
    console.log(`  ${s.email} | ${s.password} | ${s.department}`);
  }

  console.log('\n🎉 Seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
