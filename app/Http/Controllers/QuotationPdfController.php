<?php

namespace App\Http\Controllers;

use App\Models\Quotation;
use Barryvdh\DomPDF\Facade\Pdf;

class QuotationPdfController extends Controller
{
    public function show(Quotation $quotation)
    {
        $quotation->load(['items' => fn ($q) => $q->whereNull('parent_id')->with('children'), 'customer']);
        $pdf = Pdf::loadView('quotations.pdf', [
            'quotation' => $quotation,
            'company' => \App\Models\CompanySetting::current(),
        ]);

        return $pdf->stream('Quotation-' . $quotation->quotation_number . '.pdf');
    }
}