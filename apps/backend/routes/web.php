<?php

use Inertia\Inertia;
use Illuminate\Support\Facades\Route;

Route::get('/{any?}', function () {
    return Inertia::render('AppShellPage');
})->where('any', '^(?!api).*$');
