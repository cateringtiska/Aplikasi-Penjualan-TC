<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['invoice_id', 'category', 'description', 'estimated_amount', 'actual_amount', 'status', 'notes', 'created_by'])]
class InvoiceCost extends Model
{
    public function invoice()
    {
        return $this->belongsTo(Invoice::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

        public function amount(): float
    {
        $actual = (float) ($this->actual_amount ?? 0);

        if ($actual > 0) {
            return $actual;
        }

        return (float) ($this->estimated_amount ?? 0);
    }

    public function isActual(): bool
    {
        return $this->actual_amount !== null && (float) $this->actual_amount > 0;
    }

    public function categoryLabel(): string
    {
        return match ($this->category) {
            'hpp_bahan_baku' => 'HPP Bahan Baku',
            'hpp_barang' => 'HPP Barang',
            'tenaga_kerja' => 'Tenaga Kerja',
            'transportasi' => 'Transportasi',
            'delivery' => 'Delivery',
            'vendor' => 'Vendor',
            'sewa_peralatan' => 'Sewa Peralatan',
            'akomodasi' => 'Akomodasi',
            'entertainment' => 'Entertainment',
            'lain_lain' => 'Lain-lain',
            default => $this->category,
        };
    }
}