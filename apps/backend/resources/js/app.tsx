import '../css/app.css';
import './bootstrap';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

const routeTable: Record<string, string> = {
    dashboard: '/dashboard',
    login: '/login',
    register: '/register',
    logout: '/logout',
    'profile.edit': '/profile',
    'profile.update': '/profile',
    'profile.destroy': '/profile',
    'verification.send': '/email/verification-notification',
    'password.request': '/forgot-password',
    'password.email': '/forgot-password',
    'password.store': '/reset-password',
    'password.update': '/password',
    'password.confirm': '/confirm-password',
};

if (typeof globalThis !== 'undefined' && typeof (globalThis as { route?: unknown }).route !== 'function') {
    (globalThis as {
        route: (name: string, params?: Record<string, string | number | boolean>, absolute?: boolean) => string;
    }).route = (name: string, params: Record<string, string | number | boolean> = {}, absolute = false) => {
        const basePath = routeTable[name] ?? `/${name.replace(/\./g, '/')}`;
        const search = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            search.set(key, String(value));
        });
        const withQuery = search.toString() ? `${basePath}?${search.toString()}` : basePath;
        if (!absolute || typeof window === 'undefined') {
            return withQuery;
        }
        return `${window.location.origin}${withQuery}`;
    };
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map((registration) => registration.unregister()));
            if ('caches' in window) {
                const keys = await window.caches.keys();
                await Promise.all(
                    keys
                        .filter((key) => key.startsWith('eco-routes-'))
                        .map((key) => window.caches.delete(key))
                );
            }
            await navigator.serviceWorker.register('/sw.js', { scope: '/ops/' });
        } catch {
            // Ignore registration failures; the app should still boot.
        }
    });
}

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.tsx`,
            import.meta.glob('./Pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(<App {...props} />);
    },
    progress: {
        color: '#4B5563',
    },
});
