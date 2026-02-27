<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'service' => 'Eco Delivery Routes API',
        'status' => 'ok',
    ]);
});
