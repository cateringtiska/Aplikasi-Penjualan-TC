<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quotations', function (Blueprint $table) {
            $table->string('contact_person')->nullable()->after('customer_id');
            $table->string('contact_phone')->nullable()->after('contact_person');
            $table->date('event_date')->nullable()->after('valid_until');
            $table->unsignedInteger('event_days')->nullable()->after('event_date');
            $table->string('event_type')->nullable()->after('event_days');
            $table->string('event_time')->nullable()->after('event_type');
            $table->unsignedInteger('guest_count')->nullable()->after('event_time');
            $table->string('fnb_planner')->nullable()->after('guest_count');
            $table->string('venue')->nullable()->after('fnb_planner');
            $table->decimal('service_charge_percent', 5, 2)->nullable()->after('subtotal');
            $table->decimal('service_charge_amount', 15, 2)->default(0)->after('service_charge_percent');
            $table->decimal('grand_total', 15, 2)->default(0)->after('service_charge_amount');
        });

        // Backfill data lama: grand_total = subtotal (karena belum ada Service Charge sebelumnya)
        DB::table('quotations')->update(['grand_total' => DB::raw('subtotal')]);
    }

    public function down(): void
    {
        Schema::table('quotations', function (Blueprint $table) {
            $table->dropColumn([
                'contact_person', 'contact_phone', 'event_date', 'event_days',
                'event_type', 'event_time', 'guest_count', 'fnb_planner', 'venue',
                'service_charge_percent', 'service_charge_amount', 'grand_total',
            ]);
        });
    }
};