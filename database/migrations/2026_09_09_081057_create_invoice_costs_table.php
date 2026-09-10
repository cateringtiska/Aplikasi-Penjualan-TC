<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoice_costs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained('invoices')->cascadeOnDelete();
            $table->enum('category', [
                'hpp_bahan_baku', 'hpp_barang', 'tenaga_kerja', 'transportasi',
                'delivery', 'vendor', 'sewa_peralatan', 'akomodasi', 'entertainment', 'lain_lain',
            ]);
            $table->string('description');
            $table->decimal('estimated_amount', 15, 2)->nullable();
            $table->decimal('actual_amount', 15, 2)->nullable();
            $table->enum('status', ['estimasi', 'aktual'])->default('estimasi');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoice_costs');
    }
};