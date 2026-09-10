<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['quotation_id', 'parent_id', 'product_id', 'item_name', 'unit', 'qty', 'price', 'subtotal', 'is_compliment', 'charge_service'])]
class QuotationItem extends Model
{
    use HasFactory;

    public function quotation()
    {
        return $this->belongsTo(Quotation::class);
    }

        public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function parent()
    {
        return $this->belongsTo(QuotationItem::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(QuotationItem::class, 'parent_id')->orderBy('id');
    }
}