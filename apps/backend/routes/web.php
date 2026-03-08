<?php

use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return redirect()->route('dashboard');
});

Route::get('/dashboard', function () {
    return Inertia::render('Dashboard');
})->middleware(['auth'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

Route::get('/openapi.yaml', function () {
    $path = base_path('openapi.yaml');
    abort_unless(File::exists($path), 404);

    return response()->file($path, [
        'Content-Type' => 'application/yaml; charset=utf-8',
        'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma' => 'no-cache',
        'Expires' => '0',
    ]);
});

Route::middleware('api.docs.access')->group(function () {
    Route::view('/api-docs', 'api-docs')->name('api.docs');
});

Route::get('/ops/{any?}', function () {
    return Inertia::render('AppShellPage');
})->where('any', '.*')->middleware('auth');

require __DIR__.'/auth.php';
