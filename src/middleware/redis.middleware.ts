import { Elysia } from 'elysia';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export const redisCheck = (app: Elysia) =>
    app.derive(async ({ cookie, headers, request, set }) => {
        if (request.method === 'OPTIONS') {
            console.log('[TRACE] OrderAPI Redis Middleware - Skipping OPTIONS request');
            return {};
        }

        // Log pour debug
        console.log('[TRACE] OrderAPI Redis Middleware - Headers keys:', Object.keys(headers));
        const cookieHeader = headers['cookie'];
        console.log('[TRACE] OrderAPI Redis Middleware - Cookie Header:', cookieHeader);

        // Tentative 1: Via l'objet cookie d'Elysia
        let tokenValue = cookie['better-auth.session_token']?.value;

        // Tentative 2: Parsing manuel si Elysia échoue
        if (!tokenValue && cookieHeader) {
            const cookies = String(cookieHeader).split(';').reduce((acc, c) => {
                const [key, val] = c.trim().split('=');
                acc[key] = val;
                return acc;
            }, {} as Record<string, string>);
            tokenValue = cookies['better-auth.session_token'];
            if (tokenValue) {
                // Decode URI component car le cookie peut être encodé
                try {
                    tokenValue = decodeURIComponent(tokenValue);
                } catch (e) {
                    // ignore error
                }
            }
        }

        console.log('[TRACE] OrderAPI Redis Middleware - Extracted Token:', tokenValue);

        if (!tokenValue) {
            set.status = 401;
            throw new Error('No session token provided');
        }

        const token = String(tokenValue);
        console.log('[TRACE] OrderAPI Redis Middleware - Token to verify:', token);
        const session = await redis.get(token.split(".")[0]);

        if (!session) {
            console.log('[TRACE] OrderAPI Redis Middleware - Session NOT found in Redis');
            set.status = 401;
            throw new Error('Invalid or expired session');
        }

        // On suppose que la valeur stockée est du JSON (comme dans shop-api)
        let user: unknown;
        try {
            user = JSON.parse(session);
        } catch {
            // Fallback si jamais ce n'est pas du JSON
            user = { id: 'unknown', role: 'customer' };
        }

        return {
            user,
        };
    });
