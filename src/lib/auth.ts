import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const SALT_ROUNDS = 10;
const SESSION_DURATION_DEFAULT = 7 * 24 * 60 * 60 * 1000; // 7 days (normal login)
const SESSION_DURATION_REMEMBER = 30 * 24 * 60 * 60 * 1000; // 30 days (remember me)

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  user: User;
  rememberMe?: boolean;
}

/**
 * Hash password with bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate secure random token
 */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Create new user
 */
export async function createUser(data: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}): Promise<User> {
  const hashedPassword = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      password: hashedPassword,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      createdAt: true,
    },
  });

  return user;
}

/**
 * Find user by email
 */
export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
}

/**
 * Create session for user
 * @param userId - User ID
 * @param rememberMe - If true, session lasts 30 days; otherwise 7 days
 */
export async function createSession(userId: string, rememberMe: boolean = false): Promise<Session> {
  const token = generateToken();
  const duration = rememberMe ? SESSION_DURATION_REMEMBER : SESSION_DURATION_DEFAULT;
  const expiresAt = new Date(Date.now() + duration);

  const session = await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          createdAt: true,
        },
      },
    },
  });

  return { ...session, rememberMe };
}

/**
 * Validate session token
 */
export async function validateSession(
  token: string
): Promise<Session | null> {
  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          createdAt: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  // Check if session expired
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return session;
}

/**
 * Delete session (logout)
 */
export async function deleteSession(token: string): Promise<void> {
  await prisma.session.delete({ where: { token } }).catch(() => { });
}

/**
 * Delete all sessions for user
 */
export async function deleteAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  return result.count;
}

// Password Reset Functions
const RESET_TOKEN_DURATION = 60 * 60 * 1000; // 1 hour

export async function createPasswordResetToken(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    // Don't reveal if user exists or not (security)
    return null;
  }

  // Generate secure random token
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_DURATION);

  // Delete any existing unused tokens for this user
  await prisma.passwordReset.deleteMany({
    where: {
      userId: user.id,
      used: false,
    },
  });

  // Create new reset token
  const resetToken = await prisma.passwordReset.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
    },
  });

  return {
    token: resetToken.token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  };
}

export async function verifyPasswordResetToken(token: string) {
  const resetToken = await prisma.passwordReset.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!resetToken) {
    return { valid: false, error: "Invalid reset token" };
  }

  if (resetToken.used) {
    return { valid: false, error: "Reset token already used" };
  }

  if (resetToken.expiresAt < new Date()) {
    return { valid: false, error: "Reset token expired" };
  }

  return {
    valid: true,
    userId: resetToken.userId,
    user: resetToken.user,
  };
}

export async function resetPassword(token: string, newPassword: string) {
  const verification = await verifyPasswordResetToken(token);

  if (!verification.valid) {
    return { success: false, error: verification.error };
  }

  // Hash new password
  const hashedPassword = await hashPassword(newPassword);

  // Update user password and mark token as used
  await prisma.$transaction([
    prisma.user.update({
      where: { id: verification.userId },
      data: { password: hashedPassword },
    }),
    prisma.passwordReset.update({
      where: { token },
      data: { used: true },
    }),
    // Delete all existing sessions (force re-login)
    prisma.session.deleteMany({
      where: { userId: verification.userId },
    }),
  ]);

  return { success: true };
}
