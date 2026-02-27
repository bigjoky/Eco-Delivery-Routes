<?php

use Illuminate\Support\Facades\Artisan;

Artisan::command('app:health', function () {
    $this->info('Eco Delivery Routes API is healthy.');
});
