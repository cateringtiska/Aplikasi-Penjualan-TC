<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'invoice_number', 'quotation_id', 'customer_id', 'contact_person', 'contact_phone',
    'invoice_date', 'due_date', 'event_date', 'event_days', 'event_type', 'event_time',
    'guest_count', 'fnb_planner', 'venue', 'status', 'notes', 'subtotal',
    'service_charge_percent', 'service_charge_amount', 'grand_total', 'paid_amount', 'created_by',
    'show_payment_terms', 'payment_terms',
    'pb1_enabled', 'pb1_percent', 'pb1_amount',
])]
class Invoice extends Model
{
    use HasFactory;

    protected $casts = [
        'invoice_date' => 'date',
        'due_date' => 'date',
        'event_date' => 'date',
    ];
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(InvoiceItem::class);
    }

    public function quotation(): BelongsTo
    {
        return $this->belongsTo(Quotation::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public static function generateNumber(): string
    {
        $year = now()->year;

        $lastInvoice = static::whereYear('created_at', $year)
            ->orderByDesc('id')
            ->first();

        $nextNumber = $lastInvoice
            ? ((int) substr($lastInvoice->invoice_number, -4)) + 1
            : 1;

        return 'INV-' . $year . '-' . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
    }

        public function statusLabel(): string
    {
        if ($this->status === 'overdue' && $this->paid_amount > 0) {
            return 'Jatuh Tempo - Sebagian Terbayar';
        }

        return match ($this->status) {
            'unpaid' => 'Belum Dibayar',
            'partial' => 'Dibayar Sebagian',
            'paid' => 'Lunas',
            'overdue' => 'Jatuh Tempo',
            'cancelled' => 'Dibatalkan',
            default => $this->status,
        };
    }

        public function remainingAmount(): float
    {
        return (float) $this->grand_total - $this->paid_amount;
    }

    public function paymentDetails()
    {
        return $this->hasMany(PaymentDetail::class);
    }

    public function costs()
    {
        return $this->hasMany(InvoiceCost::class);
    }

    public function margin()
    {
        return $this->hasOne(InvoiceMargin::class);
    }

    public function recalculateStatus(): void
    {
        $paid = (float) $this->paymentDetails()->sum('amount_applied');
        $this->paid_amount = $paid;

        if ($this->status !== 'cancelled') {
            if ($paid >= (float) $this->grand_total && $this->grand_total > 0) {
                $this->status = 'paid';
            } elseif ($this->due_date->isPast()) {
                $this->status = 'overdue';
            } elseif ($paid > 0) {
                $this->status = 'partial';
            } else {
                $this->status = 'unpaid';
            }
        }

        $this->save();
    }
}