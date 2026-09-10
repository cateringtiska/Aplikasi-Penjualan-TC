<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->boolean('pb1_enabled')->default(false)->after('service_charge_amount');
            $table->decimal('pb1_percent', 5, 2)->nullable()->default(10)->after('pb1_enabled');
            $table->decimal('pb1_amount', 15, 2)->default(0)->after('pb1_percent');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['pb1_enabled', 'pb1_percent', 'pb1_amount']);
        });
    }
};