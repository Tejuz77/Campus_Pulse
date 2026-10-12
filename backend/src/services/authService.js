const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { AppError } = require('../middleware/errorHandler');

/**
 * Get email pattern from settings or env.
 */
async function getEmailPattern() {
  const setting = await prisma.settings.findUnique({ where: { key: 'STUDENT_EMAIL_PATTERN' } });
  const pattern = setting?.value || process.env.STUDENT_EMAIL_PATTERN || '^[a-z0-9]{10}@svecw\\.edu\\.in$';
  return new RegExp(pattern, 'i');
}

async function register({ name, email, password }) {
  const pattern = await getEmailPattern();
  if (!pattern.test(email)) {
    throw new AppError(
      'Student email must match the pattern: 10-character alphanumeric local part @svecw.edu.in (e.g. 25b05a1209@svecw.edu.in)',
      400
    );
  }

  // Derive roll_no from email local part
  const rollNo = email.split('@')[0].toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) throw new AppError('Email already registered', 409);

  const passwordHash = await argon2.hash(password);

  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: 'STUDENT',
      rollNo,
      isActive: true,
    },
  });

  const token = signToken(user.id);
  const { passwordHash: _, ...safeUser } = user;
  return { user: safeUser, token };
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { department: true },
  });

  if (!user || !user.isActive) throw new AppError('Invalid credentials', 401);

  const valid = await argon2.verify(user.passwordHash, password);
  if (!valid) throw new AppError('Invalid credentials', 401);

  const token = signToken(user.id);
  const { passwordHash, ...safeUser } = user;
  return { user: safeUser, token };
}

function signToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

module.exports = { register, login, signToken, getEmailPattern };
