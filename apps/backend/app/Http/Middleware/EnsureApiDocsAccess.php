<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureApiDocsAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! app()->environment('production')) {
            return $next($request);
        }

        $user = $request->user();
        if (! $user || ! $user->hasRole('super_admin')) {
            abort(403, 'Forbidden');
        }

        return $next($request);
    }
}
