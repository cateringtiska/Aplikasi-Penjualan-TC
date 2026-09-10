<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;


#[Fillable([
    'quotation_number', 'customer_id', 'contact_person', 'contact_phone',
    'quotation_date', 'valid_until', 'event_date', 'event_days', 'event_type', 'event_time',
    'guest_count', 'fnb_planner', 'venue', 'status', 'notes', 'subtotal',
    'service_charge_percent', 'service_charge_amount', 'grand_total', 'created_by',
    'show_payment_terms', 'payment_terms',
    'pb1_enabled', 'pb1_percent', 'pb1_amount',
])]
class Quotation extends Model
{
    use HasFactory;

    protected $casts = [
        'quotation_date' => 'date',
        'valid_until' => 'date',
        'event_date' => 'date',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

        public function items(): HasMany
    {
        return $this->hasMany(QuotationItem::class);
    }

    public function invoice(): HasOne
    {
        return $this->hasOne(Invoice::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public static function generateNumber(): string
    {
        $year = date('Y');
        $last = static::whereYear('created_at', $year)->orderByDesc('id')->first();
        $number = $last ? ((int) substr($last->quotation_number, -4)) + 1 : 1;

        return 'QUO-' . $year . '-' . str_pad($number, 4, '0', STR_PAD_LEFT);
    }

    public function statusLabel(): string
    {
        return match ($this->status) {
            'draft' => 'Draft',
            'sent' => 'Terkirim',
            'approved' => 'Disetujui',
            'rejected' => 'Ditolak',
            'expired' => 'Kadaluarsa',
            default => $this->status,
        };
    }
}