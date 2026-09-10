<?php

namespace App\Livewire;

use App\Models\Invoice;
use App\Models\Quotation;
use Livewire\Attributes\Layout;
use Livewire\Component;

#[Layout('layouts.app')]
class Dashboard extends Component
{
    public function render()
    {
        $today = now()->startOfDay();

        $piutangInvoices = Invoice::whereIn('status', ['unpaid', 'partial', 'overdue'])->get();
        $totalPiutang = $piutangInvoices->sum(fn ($invoice) => $invoice->remainingAmount());

        $penjualanBulanIni = Invoice::whereYear('invoice_date', $today->year)
            ->whereMonth('invoice_date', $today->month)
            ->where('status', '!=', 'cancelled')
            ->sum('grand_total');

        $quotationMenunggu = Quotation::whereIn('status', ['draft', 'sent'])->count();

        $invoiceJatuhTempo = Invoice::where('status', 'overdue')->count();

        $quotationTerbaru = Quotation::with('customer')->orderByDesc('id')->limit(5)->get();
        $invoiceTerbaru = Invoice::with('customer')->orderByDesc('id')->limit(5)->get();

        return view('livewire.dashboard', [
            'totalPiutang' => $totalPiutang,
            'penjualanBulanIni' => $penjualanBulanIni,
            'quotationMenunggu' => $quotationMenunggu,
            'invoiceJatuhTempo' => $invoiceJatuhTempo,
            'quotationTerbaru' => $quotationTerbaru,
            'invoiceTerbaru' => $invoiceTerbaru,
        ]);
    }
}