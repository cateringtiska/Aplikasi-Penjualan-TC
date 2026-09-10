<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['customer_code', 'name', 'address', 'phone', 'email', 'npwp', 'pic_name', 'status', 'created_by'])]
class Customer extends Model
{
    use HasFactory;

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public static function generateCode(): string
    {
        $last = static::orderByDesc('id')->first();
        $number = $last ? ((int) substr($last->customer_code, -4)) + 1 : 1;

        return 'CUST-' . str_pad($number, 4, '0', STR_PAD_LEFT);
    }
}