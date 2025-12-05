# 🔐 Authentication Implementation Guide

## ✅ Phase 1: Database Schema (DONE)

### Added Models
```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  password      String    // Hashed with bcrypt
  firstName     String?
  lastName      String?
  emailVerified DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  sessions      Session[]
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

## ✅ Phase 2: Auth Library (DONE)

### Created: `src/lib/auth.ts`

Functions:
- `hashPassword()` - Hash password with bcrypt
- `verifyPassword()` - Verify password
- `generateToken()` - Generate secure session token
- `createUser()` - Create new user
- `findUserByEmail()` - Find user by email
- `createSession()` - Create session
- `validateSession()` - Validate session token
- `deleteSession()` - Logout
- `deleteAllUserSessions()` - Logout all devices
- `cleanupExpiredSessions()` - Cleanup expired sessions

## ✅ Phase 3: API Routes (DONE)

### POST /api/auth/signup
- Validates email & password
- Checks if email exists
- Hashes password
- Creates user
- Creates session
- Sets HTTP-only cookie
- Returns user data

### POST /api/auth/signin
- Validates credentials
- Verifies password
- Creates session
- Sets HTTP-only cookie
- Returns user data

### POST /api/auth/logout
- Deletes session
- Clears cookie
- Returns success

### GET /api/auth/me
- Validates session token
- Returns current user data
- Returns 401 if not authenticated

## 🔄 Phase 4: Frontend Integration (TODO)

### Update SignInForm.tsx

```typescript
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error);
        return;
      }

      // Redirect to dashboard
      router.push("/");
      router.refresh();
    } catch (err) {
      setError("Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  // ... rest of component
}
```

### Update SignUpForm.tsx

```typescript
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignUpForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error);
        return;
      }

      // Redirect to dashboard
      router.push("/");
      router.refresh();
    } catch (err) {
      setError("Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  // ... rest of component
}
```

## 🔄 Phase 5: Authentication Middleware (TODO)

### Create: `src/middleware.ts`

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("session_token")?.value;
  const { pathname } = request.nextUrl;

  // Public routes
  const publicRoutes = ["/signin", "/signup", "/reset-password"];
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // If no token and trying to access protected route
  if (!token && !isPublicRoute) {
    return NextResponse.redirect(new URL("/signin", request.url));
  }

  // If has token and trying to access auth pages
  if (token && isPublicRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/auth/* (auth endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.png$).*)",
  ],
};
```

## 🔄 Phase 6: User Context (TODO)

### Create: `src/contexts/AuthContext.tsx`

```typescript
"use client";
import { createContext, useContext, useEffect, useState } from "react";

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const response = await fetch("/api/auth/me");
      const data = await response.json();

      if (data.success) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      window.location.href = "/signin";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, logout, refreshUser: fetchUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
```

## 📦 Required Dependencies

### Install bcryptjs and zod
```bash
npm install bcryptjs zod
npm install --save-dev @types/bcryptjs
```

## 🗄️ Database Migration

### Run migration
```bash
npx prisma migrate dev --name add_auth_models
npx prisma generate
```

## 🧪 Testing

### Test Signup
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","firstName":"Test","lastName":"User"}'
```

### Test Signin
```bash
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Test Me
```bash
curl http://localhost:3000/api/auth/me \
  -H "Cookie: session_token=YOUR_TOKEN"
```

### Test Logout
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Cookie: session_token=YOUR_TOKEN"
```

## 🔒 Security Features

### Implemented
- ✅ Password hashing with bcrypt (10 rounds)
- ✅ HTTP-only cookies (prevents XSS)
- ✅ Secure cookies in production (HTTPS only)
- ✅ SameSite=lax (CSRF protection)
- ✅ Session expiration (30 days)
- ✅ Input validation with Zod
- ✅ SQL injection prevention (Prisma)

### Recommended (Future)
- 🔶 Rate limiting on auth endpoints
- 🔶 Email verification
- 🔶 Password reset flow
- 🔶 2FA (Two-factor authentication)
- 🔶 Account lockout after failed attempts
- 🔶 Audit logging

## 📝 Next Steps

1. ✅ Install dependencies: `npm install bcryptjs zod @types/bcryptjs`
2. ✅ Run migration: `npx prisma migrate dev --name add_auth_models`
3. ✅ Update SignInForm.tsx with API integration
4. ✅ Update SignUpForm.tsx with API integration
5. ✅ Create middleware.ts for route protection
6. ✅ Create AuthContext for user state
7. ✅ Update layout to include AuthProvider
8. ✅ Test authentication flow

## 🎯 Current Status

### Completed
- ✅ Database schema
- ✅ Auth library functions
- ✅ API routes (signup, signin, logout, me)

### Remaining
- 🔄 Frontend integration (SignInForm, SignUpForm)
- 🔄 Authentication middleware
- 🔄 User context/state management
- 🔄 Install dependencies
- 🔄 Run database migration

### Estimated Time Remaining
- Dependencies & Migration: 10 minutes
- Frontend Integration: 30-45 minutes
- Middleware: 15 minutes
- Testing: 15 minutes
**Total: ~1.5 hours**

---

**Status**: Backend Complete, Frontend Pending
**Next**: Install dependencies and run migration
