<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use Barryvdh\DomPDF\Facade\Pdf;

class InvoicePdfController extends Controller
{
    public function show(Invoice $invoice)
    {
        $invoice->load(['items' => fn ($q) => $q->whereNull('parent_id')->with('children'), 'customer']);
        $pdf = Pdf::loadView('invoices.pdf', [
            'invoice' => $invoice,
            'company' => \App\Models\CompanySetting::current(),
        ]);

        return $pdf->stream('Invoice-' . $invoice->invoice_number . '.pdf');
    }
}