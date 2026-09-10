<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoice_items', function (Blueprint $table) {
            $table->foreignId('parent_id')->nullable()->after('invoice_id')
                ->constrained('invoice_items')->cascadeOnDelete();
            $table->boolean('is_compliment')->default(false)->after('subtotal');
            $table->boolean('charge_service')->default(true)->after('is_compliment');
        });
    }

    public function down(): void
    {
        Schema::table('invoice_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('parent_id');
            $table->dropColumn(['is_compliment', 'charge_service']);
        });
    }
};