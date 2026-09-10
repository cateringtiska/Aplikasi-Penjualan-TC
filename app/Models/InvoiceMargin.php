<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['invoice_id', 'net_sales', 'total_cost', 'profit', 'margin_percent', 'profit_status', 'status', 'finalized_at', 'finalized_by'])]
class InvoiceMargin extends Model
{
    protected $casts = [
        'finalized_at' => 'datetime',
    ];

    public function invoice()
    {
        return $this->belongsTo(Invoice::class);
    }

    public function finalizer()
    {
        return $this->belongsTo(User::class, 'finalized_by');
    }
}