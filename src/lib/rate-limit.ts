// Simple in-memory rate limiter
// For production, consider using Redis-based solutions like @upstash/ratelimit

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
        if (now > entry.resetTime) {
            rateLimitStore.delete(key);
        }
    }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
    interval: number; // Time window in milliseconds
    maxRequests: number; // Max requests allowed in the interval
}

export interface RateLimitResult {
    success: boolean;
    remaining: number;
    resetIn: number; // milliseconds until reset
}

/**
 * Check rate limit for a given identifier
 * @param identifier - Unique identifier (e.g., IP address, user ID)
 * @param config - Rate limit configuration
 * @returns RateLimitResult with success status and remaining requests
 */
export function checkRateLimit(
    identifier: string,
    config: RateLimitConfig
): RateLimitResult {
    const now = Date.now();
    const key = identifier;
    const entry = rateLimitStore.get(key);

    // If no entry exists or entry has expired, create new one
    if (!entry || now > entry.resetTime) {
        rateLimitStore.set(key, {
            count: 1,
            resetTime: now + config.interval,
        });
        return {
            success: true,
            remaining: config.maxRequests - 1,
            resetIn: config.interval,
        };
    }

    // Check if limit exceeded
    if (entry.count >= config.maxRequests) {
        return {
            success: false,
            remaining: 0,
            resetIn: entry.resetTime - now,
        };
    }

    // Increment count
    entry.count++;
    rateLimitStore.set(key, entry);

    return {
        success: true,
        remaining: config.maxRequests - entry.count,
        resetIn: entry.resetTime - now,
    };
}

/**
 * Get client IP from request headers
 * Works with common proxy setups (Vercel, Cloudflare, etc.)
 */
export function getClientIP(request: Request): string {
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
        return forwardedFor.split(",")[0].trim();
    }

    const realIP = request.headers.get("x-real-ip");
    if (realIP) {
        return realIP;
    }

    // Fallback for local development
    return "127.0.0.1";
}

// Preset configurations for common use cases
export const RATE_LIMITS = {
    // Sign in: 5 attempts per minute (prevent brute force)
    signin: {
        interval: 60 * 1000, // 1 minute
        maxRequests: 5,
    },
    // Forgot password: 3 requests per minute (prevent email spam)
    forgotPassword: {
        interval: 60 * 1000, // 1 minute
        maxRequests: 3,
    },
    // Sign up: 3 accounts per hour per IP
    signup: {
        interval: 60 * 60 * 1000, // 1 hour
        maxRequests: 3,
    },
} as const;
