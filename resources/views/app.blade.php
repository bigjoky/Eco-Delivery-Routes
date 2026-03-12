<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <meta name="theme-color" content="#111827">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="default">
        <meta name="apple-mobile-web-app-title" content="EcoRoutes">
        <link rel="manifest" href="/manifest.json">
        <link rel="icon" type="image/svg+xml" href="/favicon.svg">
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
        <link rel="apple-touch-icon" sizes="192x192" href="/favicon-192.png">
        <link rel="apple-touch-icon" sizes="512x512" href="/favicon-512.png">

        <title inertia>{{ config('app.name', 'Laravel') }}</title>

        <!-- Fonts -->
        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=figtree:400,500,600&display=swap" rel="stylesheet" />

        <!-- Scripts -->
        <script>
            (function () {
                var host = window.location.hostname;
                var isDevHost =
                    host === 'localhost' ||
                    host === '127.0.0.1' ||
                    /^10\./.test(host) ||
                    /^192\.168\./.test(host) ||
                    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

                window.__ECO_DISABLE_SW__ = isDevHost;

                if (isDevHost) {
                    var renderDevError = function (title, detail) {
                        var id = 'eco-dev-runtime-error';
                        var existing = document.getElementById(id);
                        if (existing) {
                            existing.remove();
                        }

                        var panel = document.createElement('div');
                        panel.id = id;
                        panel.style.position = 'fixed';
                        panel.style.left = '12px';
                        panel.style.right = '12px';
                        panel.style.bottom = '12px';
                        panel.style.zIndex = '99999';
                        panel.style.borderRadius = '12px';
                        panel.style.padding = '12px 14px';
                        panel.style.background = '#111827';
                        panel.style.color = '#f8fafc';
                        panel.style.boxShadow = '0 12px 32px rgba(15, 23, 42, 0.28)';
                        panel.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, monospace';
                        panel.style.fontSize = '12px';
                        panel.style.lineHeight = '1.5';
                        panel.innerHTML =
                            '<div style=\"font-weight:700;margin-bottom:6px;\">' +
                            title +
                            '</div><pre style=\"margin:0;white-space:pre-wrap;\">' +
                            String(detail || '') +
                            '</pre>';
                        document.body.appendChild(panel);
                    };

                    window.addEventListener('error', function (event) {
                        renderDevError('Frontend runtime error', event.error && event.error.stack ? event.error.stack : event.message);
                    });

                    window.addEventListener('unhandledrejection', function (event) {
                        var reason = event.reason && event.reason.stack ? event.reason.stack : event.reason;
                        renderDevError('Unhandled promise rejection', reason);
                    });
                }

                if (!isDevHost || !('serviceWorker' in navigator)) {
                    return;
                }

                window.__ECO_SW_CLEANUP__ = Promise.all([
                    navigator.serviceWorker.getRegistrations().then(function (registrations) {
                        return Promise.all(registrations.map(function (registration) {
                            return registration.unregister();
                        }));
                    }),
                    'caches' in window
                        ? caches.keys().then(function (keys) {
                              return Promise.all(
                                  keys
                                      .filter(function (key) {
                                          return key.indexOf('eco-routes-') === 0;
                                      })
                                      .map(function (key) {
                                          return caches.delete(key);
                                      })
                              );
                          })
                        : Promise.resolve(),
                ]).catch(function () {
                    return undefined;
                });
            })();
        </script>
        @viteReactRefresh
        @vite(['resources/js/app.tsx'])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>
