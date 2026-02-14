<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsActive
{
    private const DEACTIVATED_MESSAGE = 'Your account has been deactivated. Contact an administrator.';

    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && method_exists($user, 'isActive') && !$user->isActive()) {
            if ($token = $user->currentAccessToken()) {
                $token->delete();
            }

            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'message' => self::DEACTIVATED_MESSAGE,
                ], 403);
            }

            Auth::logout();
            if ($request->hasSession()) {
                $request->session()->invalidate();
                $request->session()->regenerateToken();
            }

            return redirect()->route('account.deactivated', [
                'message' => self::DEACTIVATED_MESSAGE,
            ]);
        }

        return $next($request);
    }
}
