<?php

use Illuminate\Support\Facades\File;
use Inertia\Inertia;
use Illuminate\Support\Facades\Route;

Route::get('/openapi.yaml', function () {
    $path = base_path('openapi.yaml');
    abort_unless(File::exists($path), 404);

    return response()->file($path, [
        'Content-Type' => 'application/yaml; charset=utf-8',
    ]);
});

Route::view('/api-docs', 'api-docs');

Route::get('/{any?}', function () {
    return Inertia::render('AppShellPage');
})->where('any', '^(?!api).*$');
