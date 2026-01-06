<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\URL;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
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
