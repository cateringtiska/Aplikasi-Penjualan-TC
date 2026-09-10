<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'invoice_id',
    'parent_id',
    'product_id',
    'item_name',
    'unit',
    'qty',
    'price',
    'subtotal',
    'is_compliment',
    'charge_service',
])]
class InvoiceItem extends Model
{
    use HasFactory;

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

       public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function parent()
    {
        return $this->belongsTo(InvoiceItem::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(InvoiceItem::class, 'parent_id')->orderBy('id');
    }
}