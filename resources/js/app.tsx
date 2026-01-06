import '../css/app.css';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeTheme } from './hooks/use-appearance';

// URL normalization utilities - MUST run before anything else
if (typeof window !== 'undefined') {
    const isProduction = import.meta.env.PROD || import.meta.env.VITE_APP_ENV === 'production';
    const isHttps = window.location.protocol === 'https:';
    const shouldForceHttps = isProduction || isHttps;
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' || 
                       window.location.port === '8000';

    /**
     * Normalize URL protocol based on environment
     */
    const normalizeUrl = (url: string | URL): string | URL => {
        if (typeof url === 'string') {
            // Handle relative URLs
            if (url.startsWith('/') || !url.includes('://')) {
                // Relative URL - return as is, will be resolved against current origin
                return url;
            }
            
            // Absolute URL - normalize protocol
            if (shouldForceHttps && url.startsWith('http://')) {
                return url.replace('http://', 'https://');
            } else if (!shouldForceHttps && url.startsWith('https://') && isLocalhost) {
                return url.replace('https://', 'http://');
            }
            return url;
        } else if (url instanceof URL) {
            // Clone to avoid modifying original
            const normalized = new URL(url.href);
            if (shouldForceHttps && normalized.protocol === 'http:') {
                normalized.protocol = 'https:';
            } else if (!shouldForceHttps && normalized.protocol === 'https:' && isLocalhost) {
                normalized.protocol = 'http:';
            }
            return normalized;
        }
        return url;
    };

    // Patch XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...args: any[]) {
        let normalizedUrl: string | URL = url;
        
        if (typeof url === 'string') {
            // Handle relative URLs by converting to absolute first
            if (url.startsWith('/') || !url.includes('://')) {
                try {
                    // Always use current origin (which should be HTTPS in production)
                    const absoluteUrl = new URL(url, window.location.origin);
                    // Ensure it uses HTTPS if we're on HTTPS
                    if (shouldForceHttps && absoluteUrl.protocol === 'http:') {
                        absoluteUrl.protocol = 'https:';
                    }
                    normalizedUrl = absoluteUrl;
                } catch {
                    normalizedUrl = normalizeUrl(url);
                }
            } else {
                // Absolute URL - normalize it
                normalizedUrl = normalizeUrl(url);
            }
        } else if (url instanceof URL) {
            // Clone the URL to avoid modifying the original
            const clonedUrl = new URL(url.href);
            if (shouldForceHttps && clonedUrl.protocol === 'http:') {
                clonedUrl.protocol = 'https:';
            }
            normalizedUrl = clonedUrl;
        }
        
        // Convert URL object to string for XMLHttpRequest
        const finalUrl = normalizedUrl instanceof URL ? normalizedUrl.href : normalizedUrl;
        
        return originalXHROpen.call(this, method, finalUrl, ...args);
    };

    // Patch fetch - always normalize URLs
    const originalFetch = window.fetch;
    window.fetch = function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        let normalizedInput: RequestInfo | URL = input;
        
        if (typeof input === 'string') {
            // Handle relative URLs by converting to absolute first
            if (input.startsWith('/') || !input.includes('://')) {
                try {
                    // Always use current origin (which should be HTTPS in production)
                    const absoluteUrl = new URL(input, window.location.origin);
                    // Ensure it uses HTTPS if we're on HTTPS
                    if (shouldForceHttps && absoluteUrl.protocol === 'http:') {
                        absoluteUrl.protocol = 'https:';
                    }
                    normalizedInput = absoluteUrl.href;
                } catch {
                    normalizedInput = normalizeUrl(input);
                }
            } else {
                // Absolute URL - normalize it
                normalizedInput = normalizeUrl(input);
            }
        } else if (input instanceof URL) {
            // Clone and normalize
            const cloned = new URL(input.href);
            if (shouldForceHttps && cloned.protocol === 'http:') {
                cloned.protocol = 'https:';
            }
            normalizedInput = cloned;
        } else if (input instanceof Request) {
            // For Request objects, normalize the URL
            const url = input.url;
            if (url.startsWith('/') || !url.includes('://')) {
                try {
                    // Always use current origin
                    const absoluteUrl = new URL(url, window.location.origin);
                    if (shouldForceHttps && absoluteUrl.protocol === 'http:') {
                        absoluteUrl.protocol = 'https:';
                    }
                    input = new Request(absoluteUrl.href, input);
                } catch {
                    const normalizedUrl = normalizeUrl(url);
                    input = new Request(normalizedUrl instanceof URL ? normalizedUrl.href : normalizedUrl, input);
                }
            } else {
                const normalizedUrl = normalizeUrl(url);
                input = new Request(normalizedUrl instanceof URL ? normalizedUrl.href : normalizedUrl, input);
            }
            normalizedInput = input;
        }
        
        return originalFetch(normalizedInput as RequestInfo | URL, init);
    };

    // Patch route helper
    const patchRouteHelper = () => {
        if ((window as any).route) {
            const originalRoute = (window as any).route;
            (window as any).route = (name: string, params?: any, absolute?: boolean) => {
                const url = originalRoute(name, params, absolute);
                if (typeof url === 'string') {
                    return normalizeUrl(url) as string;
                }
                return url;
            };
        }
    };

    if ((window as any).route) {
        patchRouteHelper();
    } else {
        window.addEventListener('DOMContentLoaded', patchRouteHelper);
    }
}

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    resolve: (name) =>
        resolvePageComponent(
            `./pages/${name}.tsx`,
            import.meta.glob('./pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        // Normalize Ziggy routes based on current protocol
        if (props.initialPage.props.ziggy && typeof window !== 'undefined') {
            const ziggy = props.initialPage.props.ziggy;
            const isProduction = import.meta.env.PROD || import.meta.env.VITE_APP_ENV === 'production';
            const isHttps = window.location.protocol === 'https:';
            const shouldForceHttps = isProduction || isHttps;
            const currentProtocol = window.location.protocol;
            const currentHost = window.location.host;
            
            // Normalize Ziggy base URLs
            if (ziggy.location && typeof ziggy.location === 'string') {
                if (currentProtocol === 'http:' && ziggy.location.startsWith('https://')) {
                    ziggy.location = ziggy.location.replace('https://', 'http://');
                    ziggy.location = ziggy.location.replace(/https?:\/\/[^\/]+/, `${currentProtocol}//${currentHost}`);
                } else if (shouldForceHttps && ziggy.location.startsWith('http://')) {
                    ziggy.location = ziggy.location.replace('http://', 'https://');
                }
            }
            
            if (ziggy.url && typeof ziggy.url === 'string') {
                if (currentProtocol === 'http:' && ziggy.url.startsWith('https://')) {
                    ziggy.url = ziggy.url.replace('https://', 'http://');
                    ziggy.url = ziggy.url.replace(/https?:\/\/[^\/]+/, `${currentProtocol}//${currentHost}`);
                } else if (shouldForceHttps && ziggy.url.startsWith('http://')) {
                    ziggy.url = ziggy.url.replace('http://', 'https://');
                }
            }
            
            // Override route function
            const originalRoute = (window as any).route;
            if (originalRoute) {
                (window as any).route = (name: string, params?: any, absolute?: boolean) => {
                    let url = originalRoute(name, params, absolute);
                    if (typeof url === 'string') {
                        if (currentProtocol === 'http:' && url.startsWith('https://')) {
                            url = url.replace('https://', 'http://');
                            url = url.replace(/https?:\/\/[^\/]+/, `${currentProtocol}//${currentHost}`);
                        } else if (shouldForceHttps && url.startsWith('http://')) {
                            url = url.replace('http://', 'https://');
                        }
                    }
                    return url;
                };
            }
        }

        const root = createRoot(el);

        root.render(
            <StrictMode>
                <App {...props} />
            </StrictMode>,
        );
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();
