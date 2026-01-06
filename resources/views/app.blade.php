<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" @class(['dark' => ($appearance ?? 'system') == 'dark'])>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">

        {{-- Inline script to detect system dark mode preference and apply it immediately --}}
        <script>
            (function() {
                const appearance = '{{ $appearance ?? "system" }}';

                if (appearance === 'system') {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

                    if (prefersDark) {
                        document.documentElement.classList.add('dark');
                    }
                }
            })();
        </script>

        {{-- Inline style to set the HTML background color based on our theme in app.css --}}
        <style>
            html {
                background-color: oklch(1 0 0);
            }

            html.dark {
                background-color: oklch(0.145 0 0);
            }
        </style>

        <title inertia>{{ config('app.name', 'Laravel') }}</title>

        <link rel="icon" href="/favicon.ico" sizes="any">
        <link rel="icon" href="/favicon.svg" type="image/svg+xml">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">

        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600" rel="stylesheet" />

        {{-- Mixed Content Error Handling: Force HTTPS in production --}}
        @if(config('app.env') === 'production')
        <script>
            (function() {
                'use strict';
                
                // Only run HTTPS forcing in production
                if (window.location.protocol === 'https:') {
                    // Fix HTTP asset URLs in the HTML before they're loaded
                    document.addEventListener('DOMContentLoaded', function() {
                        // Patch stylesheet links
                        const links = document.querySelectorAll('link[rel="stylesheet"]');
                        links.forEach(function(link) {
                            if (link.href && link.href.startsWith('http://')) {
                                link.href = link.href.replace('http://', 'https://');
                            }
                        });
                        
                        // Patch script tags
                        const scripts = document.querySelectorAll('script[src]');
                        scripts.forEach(function(script) {
                            if (script.src && script.src.startsWith('http://')) {
                                script.src = script.src.replace('http://', 'https://');
                            }
                        });
                    });
                    
                    // Force HTTPS for all fetch requests in production
                    const originalFetch = window.fetch;
                    window.fetch = function(input, init) {
                        if (typeof input === 'string' && input.startsWith('http://')) {
                            input = input.replace('http://', 'https://');
                        } else if (input instanceof Request && input.url.startsWith('http://')) {
                            input = new Request(input.url.replace('http://', 'https://'), input);
                        }
                        return originalFetch.call(this, input, init);
                    };
                    
                    // Force HTTPS for all XMLHttpRequest in production
                    const originalOpen = XMLHttpRequest.prototype.open;
                    XMLHttpRequest.prototype.open = function(method, url, ...args) {
                        if (typeof url === 'string' && url.startsWith('http://')) {
                            url = url.replace('http://', 'https://');
                        }
                        return originalOpen.call(this, method, url, ...args);
                    };
                    
                    // Patch route helper in production
                    const patchRoute = function() {
                        if (window.route && typeof window.route === 'function') {
                            const originalRoute = window.route;
                            window.route = function(name, params, absolute) {
                                const url = originalRoute(name, params, absolute);
                                if (typeof url === 'string' && url.startsWith('http://')) {
                                    return url.replace('http://', 'https://');
                                }
                                return url;
                            };
                        }
                    };
                    
                    patchRoute();
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', patchRoute);
                    }
                    setTimeout(patchRoute, 100);
                }
            })();
        </script>
        @endif

        @viteReactRefresh
        @vite(['resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>
