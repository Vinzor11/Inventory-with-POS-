# Mixed Content Error Handling Guide

This guide documents how the HR system handles Mixed Content errors, which occur when an HTTPS page tries to load HTTP resources (stylesheets, scripts, etc.). The system implements a comprehensive multi-layer approach to prevent and fix these errors.

## Table of Contents

1. [Understanding Mixed Content Errors](#understanding-mixed-content-errors)
2. [Error Example](#error-example)
3. [Solution Architecture](#solution-architecture)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Blade Template Implementation](#frontend-blade-template-implementation)
6. [Frontend React App Implementation](#frontend-react-app-implementation)
7. [Complete Code Examples](#complete-code-examples)
8. [Integration Guide](#integration-guide)
9. [Troubleshooting](#troubleshooting)

---

## Understanding Mixed Content Errors

### What is Mixed Content?

Mixed Content occurs when:
- A page is loaded over **HTTPS** (secure connection)
- But requests resources (CSS, JavaScript, images, etc.) over **HTTP** (insecure connection)

Modern browsers block these insecure requests for security reasons, resulting in errors like:

```
Mixed Content: The page at 'https://example.com/' was loaded over HTTPS, 
but requested an insecure stylesheet 'http://example.com/build/assets/app.css'. 
This request has been blocked; the content must be served over HTTPS.
```

### Why This Happens

Common causes:
1. **APP_URL Configuration**: Backend `APP_URL` set to `http://` instead of `https://`
2. **Asset URL Generation**: Vite/Laravel generating HTTP URLs for assets
3. **Route Helper URLs**: Route helpers returning HTTP URLs
4. **Proxy/Load Balancer**: Application behind proxy that doesn't forward HTTPS headers correctly
5. **Development vs Production**: Different protocols in different environments

---

## Error Example

### Browser Console Errors

```
(index):1 Mixed Content: The page at 'https://joshua-trading.up.railway.app/' 
was loaded over HTTPS, but requested an insecure stylesheet 
'http://joshua-trading.up.railway.app/build/assets/app-BTnS883o.css'. 
This request has been blocked; the content must be served over HTTPS.

(index):42 Mixed Content: The page at 'https://joshua-trading.up.railway.app/' 
was loaded over HTTPS, but requested an insecure script 
'http://joshua-trading.up.railway.app/build/assets/app.js'. 
This request has been blocked; the content must be served over HTTPS.
```

### Symptoms

- Stylesheets not loading (page appears unstyled)
- JavaScript files not loading (functionality broken)
- Images or other assets not loading
- Console errors about blocked requests

---

## Solution Architecture

The HR system implements a **multi-layer defense** strategy:

1. **Backend Layer**: Force HTTPS URLs in production
2. **Blade Template Layer**: Patch HTTP URLs in HTML before they load
3. **React App Layer**: Normalize all URLs in JavaScript at runtime
4. **Route Helper Layer**: Ensure route helpers return HTTPS URLs

### Defense Layers

```
┌─────────────────────────────────────────┐
│  Browser (HTTPS Page)                    │
└─────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│  Layer 1: Blade Template                │
│  - Patch <link> and <script> tags       │
│  - Patch fetch/XMLHttpRequest           │
└─────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│  Layer 2: React App (app.tsx)           │
│  - Normalize all URLs                    │
│  - Patch XMLHttpRequest                 │
│  - Patch fetch                          │
│  - Patch route helper                   │
└─────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│  Layer 3: Backend (AppServiceProvider)   │
│  - Force HTTPS scheme                   │
│  - Normalize APP_URL                    │
└─────────────────────────────────────────┘
```

---

## Backend Implementation

### 1. AppServiceProvider Configuration

**File**: `app/Providers/AppServiceProvider.php`

```php
<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\URL;

class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // Force HTTPS URLs ONLY in production
        // In development, explicitly use HTTP
        if (config('app.env') === 'production') {
            // Force all generated URLs to use HTTPS
            URL::forceScheme('https');
            
            // Ensure APP_URL uses HTTPS for Vite asset generation
            $appUrl = config('app.url');
            if ($appUrl && str_starts_with($appUrl, 'http://')) {
                config(['app.url' => str_replace('http://', 'https://', $appUrl)]);
            }
        } else {
            // In development, explicitly force HTTP
            URL::forceScheme('http');
            
            // Ensure APP_URL uses HTTP in development
            $appUrl = config('app.url');
            if ($appUrl && str_starts_with($appUrl, 'https://')) {
                config(['app.url' => str_replace('https://', 'http://', $appUrl)]);
            }
        }
    }
}
```

**Key Features**:
- **Production**: Forces HTTPS for all URL generation
- **Development**: Forces HTTP for local development
- **APP_URL Normalization**: Ensures `APP_URL` matches the forced scheme
- **Vite Compatibility**: Normalized `APP_URL` ensures Vite generates correct asset URLs

### 2. Authentication Controller

**File**: `app/Http/Controllers/Auth/AuthenticatedSessionController.php`

```php
// Ensure HTTPS for redirect URL
$dashboardUrl = route('dashboard', absolute: false);
if (str_starts_with($dashboardUrl, 'http://')) {
    $dashboardUrl = str_replace('http://', 'https://', $dashboardUrl);
}
return redirect()->intended($dashboardUrl);
```

**Purpose**: Ensures redirect URLs use HTTPS after authentication.

---

## Frontend Blade Template Implementation

### HTML-Level URL Patching

**File**: `resources/views/app.blade.php`

This implementation patches HTTP URLs **before** the browser tries to load them:

```php
{{-- Only force HTTPS in production - in development, use HTTP --}}
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
```

**Key Features**:
- **Early Patching**: Runs before React app loads
- **DOM Patching**: Fixes `<link>` and `<script>` tags in HTML
- **Fetch Patching**: Ensures `fetch()` uses HTTPS
- **XMLHttpRequest Patching**: Ensures XHR uses HTTPS
- **Route Helper Patching**: Ensures route helper returns HTTPS URLs
- **Production Only**: Only runs in production environment

---

## Frontend React App Implementation

### Comprehensive URL Normalization

**File**: `resources/js/app.tsx`

This is the most comprehensive layer, normalizing URLs at multiple levels:

#### 1. URL Normalization Utility

```typescript
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
}
```

#### 2. Axios Interceptor

```typescript
// Configure axios
axios.defaults.baseURL = window.location.origin;
axios.defaults.withCredentials = true;
axios.defaults.withXSRFToken = true;

// Axios interceptor for URL normalization and CSRF token
axios.interceptors.request.use((config) => {
    // Normalize URLs
    if (config.url && typeof config.url === 'string') {
        config.url = normalizeUrl(config.url) as string;
    }
    if (config.baseURL && typeof config.baseURL === 'string') {
        config.baseURL = normalizeUrl(config.baseURL) as string;
    }
    
    return config;
});
```

#### 3. XMLHttpRequest Patching

```typescript
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
```

#### 4. Fetch API Patching

```typescript
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
```

#### 5. Route Helper Patching

```typescript
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
```

#### 6. Ziggy Route Normalization

```typescript
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
```

---

## Complete Code Examples

### Example 1: Backend Service Provider

```php
<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\URL;

class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // Force HTTPS URLs ONLY in production
        if (config('app.env') === 'production') {
            URL::forceScheme('https');
            
            // Ensure APP_URL uses HTTPS for Vite asset generation
            $appUrl = config('app.url');
            if ($appUrl && str_starts_with($appUrl, 'http://')) {
                config(['app.url' => str_replace('http://', 'https://', $appUrl)]);
            }
        } else {
            // In development, explicitly force HTTP
            URL::forceScheme('http');
            
            // Ensure APP_URL uses HTTP in development
            $appUrl = config('app.url');
            if ($appUrl && str_starts_with($appUrl, 'https://')) {
                config(['app.url' => str_replace('https://', 'http://', $appUrl)]);
            }
        }
    }
}
```

### Example 2: Blade Template Script

```html
@if(config('app.env') === 'production')
<script>
    (function() {
        'use strict';
        
        if (window.location.protocol === 'https:') {
            // Fix HTTP asset URLs in the HTML before they're loaded
            document.addEventListener('DOMContentLoaded', function() {
                const links = document.querySelectorAll('link[rel="stylesheet"]');
                links.forEach(function(link) {
                    if (link.href && link.href.startsWith('http://')) {
                        link.href = link.href.replace('http://', 'https://');
                    }
                });
                
                const scripts = document.querySelectorAll('script[src]');
                scripts.forEach(function(script) {
                    if (script.src && script.src.startsWith('http://')) {
                        script.src = script.src.replace('http://', 'https://');
                    }
                });
            });
            
            // Force HTTPS for all fetch requests
            const originalFetch = window.fetch;
            window.fetch = function(input, init) {
                if (typeof input === 'string' && input.startsWith('http://')) {
                    input = input.replace('http://', 'https://');
                } else if (input instanceof Request && input.url.startsWith('http://')) {
                    input = new Request(input.url.replace('http://', 'https://'), input);
                }
                return originalFetch.call(this, input, init);
            };
            
            // Force HTTPS for all XMLHttpRequest
            const originalOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url, ...args) {
                if (typeof url === 'string' && url.startsWith('http://')) {
                    url = url.replace('http://', 'https://');
                }
                return originalOpen.call(this, method, url, ...args);
            };
        }
    })();
</script>
@endif
```

### Example 3: React URL Normalization

```typescript
// URL normalization utility
const normalizeUrl = (url: string | URL): string | URL => {
    const isProduction = import.meta.env.PROD;
    const isHttps = window.location.protocol === 'https:';
    const shouldForceHttps = isProduction || isHttps;
    
    if (typeof url === 'string') {
        if (url.startsWith('/') || !url.includes('://')) {
            return url; // Relative URL - use as is
        }
        
        if (shouldForceHttps && url.startsWith('http://')) {
            return url.replace('http://', 'https://');
        }
        return url;
    } else if (url instanceof URL) {
        const normalized = new URL(url.href);
        if (shouldForceHttps && normalized.protocol === 'http:') {
            normalized.protocol = 'https:';
        }
        return normalized;
    }
    return url;
};

// Patch fetch
const originalFetch = window.fetch;
window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
    let normalizedInput = input;
    
    if (typeof input === 'string') {
        normalizedInput = normalizeUrl(input) as string;
    } else if (input instanceof URL) {
        normalizedInput = normalizeUrl(input) as URL;
    }
    
    return originalFetch(normalizedInput as RequestInfo | URL, init);
};
```

---

## Integration Guide

### Step 1: Backend Configuration

1. **Update AppServiceProvider**:
   - Add HTTPS forcing in production
   - Normalize `APP_URL` configuration

2. **Environment Configuration**:
   ```env
   # Production
   APP_URL=https://your-domain.com
   APP_ENV=production
   
   # Development
   APP_URL=http://localhost:8000
   APP_ENV=local
   ```

### Step 2: Blade Template

1. **Add Script to Blade Template**:
   - Add the HTTPS patching script to your main Blade template
   - Ensure it runs before React app loads

2. **Placement**:
   - Place in `<head>` section
   - Before `@vite` directives

### Step 3: React App

1. **Add URL Normalization**:
   - Add normalization utility to `app.tsx`
   - Patch `fetch`, `XMLHttpRequest`, and route helpers

2. **Order of Operations**:
   - URL normalization must run **before** any other code
   - Place at the top of `app.tsx`

### Step 4: Testing

1. **Production Testing**:
   - Deploy to production environment
   - Check browser console for mixed content errors
   - Verify all assets load correctly

2. **Development Testing**:
   - Ensure HTTP works in development
   - Verify HTTPS forcing doesn't break local development

---

## Troubleshooting

### Issue: Assets Still Loading Over HTTP

**Problem**: Despite all patches, some assets still load over HTTP.

**Solutions**:
1. **Check APP_URL**: Ensure `APP_URL` is set to HTTPS in production
2. **Clear Cache**: Clear browser cache and Laravel cache
3. **Check Vite Config**: Ensure Vite is using correct base URL
4. **Verify Script Order**: Ensure patching scripts run before assets load

### Issue: Development Broken

**Problem**: HTTPS forcing breaks local development.

**Solutions**:
1. **Environment Check**: Ensure `APP_ENV=local` in development
2. **Conditional Logic**: Only force HTTPS in production
3. **Check APP_URL**: Ensure development uses `http://localhost:8000`

### Issue: Route Helper Still Returns HTTP

**Problem**: Route helper returns HTTP URLs even after patching.

**Solutions**:
1. **Check Ziggy Config**: Ensure Ziggy base URL is correct
2. **Verify Patching**: Ensure route helper is patched after Ziggy loads
3. **Check Backend**: Ensure `URL::forceScheme('https')` is called

### Issue: Fetch/XHR Still Using HTTP

**Problem**: Network requests still use HTTP protocol.

**Solutions**:
1. **Verify Patching**: Ensure fetch/XHR patches are applied
2. **Check Timing**: Ensure patches run before requests are made
3. **Check Axios**: Ensure axios baseURL is set correctly

### Issue: Stylesheets Not Loading

**Problem**: CSS files blocked by mixed content policy.

**Solutions**:
1. **Check Blade Script**: Ensure DOM patching runs on `DOMContentLoaded`
2. **Verify Link Tags**: Check that `<link>` tags are being patched
3. **Check Vite**: Ensure Vite generates correct asset URLs

---

## Best Practices

### 1. Environment-Based Configuration

- **Production**: Always force HTTPS
- **Development**: Use HTTP for local development
- **Staging**: Match production behavior

### 2. Multiple Layers of Defense

- Don't rely on a single solution
- Implement backend, Blade, and React layers
- Each layer catches different scenarios

### 3. Early Patching

- Patch URLs as early as possible
- Blade template patches run before React
- React patches run before any requests

### 4. Relative URLs When Possible

- Use relative URLs for same-origin resources
- Browser automatically uses current protocol
- Reduces need for URL normalization

### 5. Testing

- Test in both development and production
- Check browser console for errors
- Verify all asset types (CSS, JS, images)

### 6. Monitoring

- Monitor browser console for mixed content warnings
- Set up alerts for production issues
- Log URL normalization events

---

## Summary

The HR system handles Mixed Content errors through a comprehensive multi-layer approach:

1. **Backend Layer** (`AppServiceProvider`):
   - Forces HTTPS scheme in production
   - Normalizes `APP_URL` configuration

2. **Blade Template Layer** (`app.blade.php`):
   - Patches HTML elements before they load
   - Patches fetch and XMLHttpRequest early

3. **React App Layer** (`app.tsx`):
   - Normalizes all URLs at runtime
   - Patches fetch, XMLHttpRequest, and route helpers
   - Handles Ziggy route normalization

**Key Points**:
- Multiple layers ensure comprehensive coverage
- Production-only enforcement prevents development issues
- Early patching prevents errors before they occur
- Relative URLs reduce need for normalization

This approach ensures that even if one layer fails, others catch and fix HTTP URLs, preventing Mixed Content errors in production environments.

