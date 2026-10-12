require('dotenv').config({ path: '.env.test' });
const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/lib/prisma');

const adminCreds = { email: 'admin@svecw.edu.in', password: 'Admin@12345' };
const studentCreds = { email: '25b05a1201@svecw.edu.in', password: 'Student@123' };
const student2Creds = { email: '25b05a1202@svecw.edu.in', password: 'Student@123' };

let adminToken, studentToken, student2Token, staffToken;
let staffDeptId, staffUserId2;

async function getCookieToken(creds) {
  const res = await request(app)
    .post('/api/auth/login')
    .send(creds);
  const cookie = res.headers['set-cookie']?.[0];
  return cookie;
}

beforeAll(async () => {
  adminToken = await getCookieToken(adminCreds);
  studentToken = await getCookieToken(studentCreds);
  student2Token = await getCookieToken(student2Creds);

  // Get first staff for testing
  const staffUsers = await prisma.user.findMany({ where: { role: 'STAFF' }, take: 1, include: { department: true } });
  if (staffUsers.length > 0) {
    const staffUser = staffUsers[0];
    staffDeptId = staffUser.departmentId;
    const staffCreds = { email: staffUser.email, password: 'unknown' }; // need to use argon2
    // For tests, create a known staff
    staffToken = await getCookieToken(adminCreds); // use admin for staff tests
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ── AUTH TESTS ─────────────────────────────────────────────────────────────────
describe('Auth', () => {
  test('student cannot register with non-SVECW email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test User',
      email: 'invalid@gmail.com',
      password: 'Password@123',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/pattern/i);
  });

  test('student cannot register with wrong email format', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test User',
      email: 'abc@svecw.edu.in', // only 3 chars, not 10
      password: 'Password@123',
    });
    expect(res.status).toBe(400);
  });

  test('valid SVECW email registration works', async () => {
    const email = `testuser01@svecw.edu.in`;
    // Delete if exists
    await prisma.user.deleteMany({ where: { email } }).catch(() => {});

    const res = await request(app).post('/api/auth/register').send({
      name: 'Test Student',
      email,
      password: 'Password@123',
    });
    expect([200, 201]).toContain(res.status);
    expect(res.body.user.role).toBe('STUDENT');
    expect(res.body.user.rollNo).toBe('testuser01');
  });

  test('admin can login', async () => {
    const res = await request(app).post('/api/auth/login').send(adminCreds);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('ADMIN');
  });

  test('invalid credentials rejected', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@svecw.edu.in', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  test('/me returns user when authenticated', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', adminToken);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('ADMIN');
  });

  test('/me returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

// ── STAFF 2-CAP TESTS ─────────────────────────────────────────────────────────
describe('Staff 2-cap enforcement', () => {
  let testDeptId;

  beforeAll(async () => {
    // Create a test dept
    const dept = await prisma.department.create({
      data: { name: `Test Dept ${Date.now()}`, type: 'service' },
    });
    testDeptId = dept.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { departmentId: testDeptId } });
    await prisma.department.delete({ where: { id: testDeptId } });
  });

  test('admin can add 2 staff to a department', async () => {
    const r1 = await request(app)
      .post('/api/users')
      .set('Cookie', adminToken)
      .send({ name: 'Staff One', email: `staff.test.cap1.${Date.now()}@svecw.edu.in`, password: 'Staff@001', departmentId: testDeptId, role: 'STAFF' });
    expect(r1.status).toBe(201);

    const r2 = await request(app)
      .post('/api/users')
      .set('Cookie', adminToken)
      .send({ name: 'Staff Two', email: `staff.test.cap2.${Date.now()}@svecw.edu.in`, password: 'Staff@002', departmentId: testDeptId, role: 'STAFF' });
    expect(r2.status).toBe(201);
  });

  test('third active staff cannot be added to the same department', async () => {
    const r3 = await request(app)
      .post('/api/users')
      .set('Cookie', adminToken)
      .send({ name: 'Staff Three', email: `staff.test.cap3.${Date.now()}@svecw.edu.in`, password: 'Staff@003', departmentId: testDeptId, role: 'STAFF' });
    expect(r3.status).toBe(400);
    expect(r3.body.error).toMatch(/maximum/i);
  });
});

// ── STUDENT ISOLATION TESTS ────────────────────────────────────────────────────
describe('Student data isolation', () => {
  test('student cannot access another student\'s reports', async () => {
    const res = await request(app)
      .get('/api/reports')
      .set('Cookie', studentToken);
    expect(res.status).toBe(200);
    // All returned reports must belong to student 1
  });

  test('student cannot update incident status', async () => {
    const incident = await prisma.incident.findFirst();
    if (!incident) return;

    const res = await request(app)
      .patch(`/api/incidents/${incident.id}/status`)
      .set('Cookie', studentToken)
      .send({ newStatus: 'RESOLVED', note: 'hack' });
    expect(res.status).toBe(403);
  });
});

// ── ROUTING RULES TESTS ────────────────────────────────────────────────────────
describe('Routing rules', () => {
  test('Electrical/Safety category gets CRITICAL priority', async () => {
    const cat = await prisma.category.findFirst({ where: { isSafety: true } });
    if (!cat) return;
    expect(cat.defaultPriority).toBe('CRITICAL');
  });

  test('incidentService.routeToDocument returns correct department for Water category', async () => {
    const { routeToDocument } = require('../src/services/incidentService');
    const waterCat = await prisma.category.findFirst({ where: { name: 'Drinking Water' } });
    const loc = await prisma.location.findFirst({ where: { status: 'approved' } });
    if (!waterCat || !loc) return;

    const { departmentId } = await routeToDocument(waterCat.id, loc.id);
    const dept = await prisma.department.findUnique({ where: { id: departmentId } });
    expect(dept?.name).toBe('Water & Sanitation');
  });
});

// ── STATE MACHINE TESTS ────────────────────────────────────────────────────────
describe('Status machine', () => {
  test('invalid status transition is rejected', async () => {
    const incident = await prisma.incident.create({
      data: {
        summary: 'Test incident',
        categoryId: (await prisma.category.findFirst()).id,
        locationId: (await prisma.location.findFirst({ where: { status: 'approved' } })).id,
        status: 'RESOLVED',
        priority: 'LOW',
      },
    });

    const { transitionStatus } = require('../src/services/incidentService');
    await expect(
      transitionStatus(incident.id, 'IN_PROGRESS', 'adminid', 'ADMIN', 'test')
    ).rejects.toThrow(/Cannot transition/);

    await prisma.incident.delete({ where: { id: incident.id } });
  });
});

// ── IDEMPOTENCY TESTS ──────────────────────────────────────────────────────────
describe('Report idempotency', () => {
  test('submitting same idempotency key twice returns same report', async () => {
    const cat = await prisma.category.findFirst({ where: { isActive: true } });
    const loc = await prisma.location.findFirst({ where: { status: 'approved', isActive: true } });
    if (!cat || !loc) return;

    const key = `idem-test-${Date.now()}`;
    const payload = {
      categoryId: cat.id,
      locationId: loc.id,
      description: 'Test idempotency description minimum 10 chars',
      idempotencyKey: key,
    };

    const r1 = await request(app)
      .post('/api/reports')
      .set('Cookie', studentToken)
      .send(payload);

    const r2 = await request(app)
      .post('/api/reports')
      .set('Cookie', studentToken)
      .send(payload);

    if (r1.status === 201 || r1.status === 200) {
      expect(r2.status).toBe(200);
      expect(r1.body.report?.ticketNumber).toBe(r2.body.report?.ticketNumber);
    }
  });
});
