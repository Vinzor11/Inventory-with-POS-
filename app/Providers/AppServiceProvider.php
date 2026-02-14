<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Gate;
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
        Gate::define('can_receive_stock', function (User $user): bool {
            return $user->isAdmin();
        });

        Gate::define('can_produce', function (User $user): bool {
            return $user->isAdmin();
        });

        Gate::define('can_adjust_stock', function (User $user): bool {
            return $user->isAdmin();
        });

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
