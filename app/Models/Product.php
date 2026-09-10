<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['product_code', 'name', 'type', 'unit', 'default_price', 'description', 'status', 'created_by'])]
class Product extends Model
{
    use HasFactory;

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public static function generateCode(): string
    {
        $last = static::orderByDesc('id')->first();
        $number = $last ? ((int) substr($last->product_code, -4)) + 1 : 1;

        return 'PRD-' . str_pad($number, 4, '0', STR_PAD_LEFT);
    }
}