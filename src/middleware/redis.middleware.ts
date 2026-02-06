import { Elysia } from 'elysia';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export const redisCheck = (app: Elysia) =>
    app.derive(async ({ cookie, set }) => {
        // Même logique que dans `authenticate` côté shop-api :
        // 1. On récupère le token depuis le cookie `better-auth.session_token`
        // 2. On vérifie dans Redis que la session existe

        const sessionToken = cookie['better-auth.session_token'];

        if (!sessionToken || !sessionToken.value) {
            set.status = 401;
            throw new Error('No session token provided');
        }

        const token = String(sessionToken.value);
        const session = await redis.get(token.split(".")[0]);

        if (!session) {
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
