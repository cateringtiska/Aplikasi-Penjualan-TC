<?php

namespace App\Livewire;

use App\Models\Invoice;
use Livewire\Attributes\Layout;
use Livewire\Component;

#[Layout('layouts.app')]
class LaporanMargin extends Component
{
    public $search = '';

    public function render()
    {
        $invoices = Invoice::with(['customer', 'margin'])
            ->where('status', '!=', 'cancelled')
            ->orderByDesc('invoice_date')
            ->get();

        if ($this->search) {
            $keyword = strtolower($this->search);
            $invoices = $invoices->filter(fn ($invoice) => str_contains(strtolower($invoice->invoice_number), $keyword)
                || str_contains(strtolower($invoice->customer->name), $keyword));
        }

        $totalNetSales = $invoices->sum(fn ($invoice) => $invoice->margin->net_sales ?? 0);
        $totalCost = $invoices->sum(fn ($invoice) => $invoice->margin->total_cost ?? 0);
        $totalProfit = $totalNetSales - $totalCost;
        $avgMarginPercent = $totalNetSales > 0 ? round(($totalProfit / $totalNetSales) * 100, 2) : 0;

        return view('livewire.laporan-margin', [
            'invoices' => $invoices,
            'totalNetSales' => $totalNetSales,
            'totalCost' => $totalCost,
            'totalProfit' => $totalProfit,
            'avgMarginPercent' => $avgMarginPercent,
        ]);
    }
}