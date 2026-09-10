<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['payment_number', 'payment_date', 'customer_id', 'payment_method', 'bank_cash', 'total_amount', 'notes', 'created_by'])]
class Payment extends Model
{
    use HasFactory;

    protected $casts = [
        'payment_date' => 'date',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function details()
    {
        return $this->hasMany(PaymentDetail::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public static function generateNumber(): string
    {
        $year = date('Y');
        $last = static::whereYear('created_at', $year)->orderByDesc('id')->first();
        $number = $last ? ((int) substr($last->payment_number, -4)) + 1 : 1;

        return 'PAY-' . $year . '-' . str_pad($number, 4, '0', STR_PAD_LEFT);
    }

    public function methodLabel(): string
    {
        return match ($this->payment_method) {
            'cash' => 'Tunai',
            'transfer' => 'Transfer Bank',
            'giro' => 'Giro',
            'lainnya' => 'Lainnya',
            default => $this->payment_method,
        };
    }
}