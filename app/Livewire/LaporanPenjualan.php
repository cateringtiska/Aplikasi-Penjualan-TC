<?php

namespace App\Livewire;

use App\Exports\LaporanPenjualanExport;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Quotation;
use Barryvdh\DomPDF\Facade\Pdf;
use Livewire\Attributes\Layout;
use Livewire\Component;
use Maatwebsite\Excel\Facades\Excel;

#[Layout('layouts.app')]
class LaporanPenjualan extends Component
{
    public $tanggalDari = '';
    public $tanggalSampai = '';
    public $customerId = '';

    public function resetFilter()
    {
        $this->reset(['tanggalDari', 'tanggalSampai', 'customerId']);
    }

    protected function filteredInvoices()
    {
        return Invoice::with('customer')
            ->when($this->tanggalDari, fn ($q) => $q->whereDate('invoice_date', '>=', $this->tanggalDari))
            ->when($this->tanggalSampai, fn ($q) => $q->whereDate('invoice_date', '<=', $this->tanggalSampai))
            ->when($this->customerId, fn ($q) => $q->where('customer_id', $this->customerId))
            ->orderByDesc('invoice_date');
    }

    protected function filteredQuotations()
    {
        return Quotation::when($this->tanggalDari, fn ($q) => $q->whereDate('quotation_date', '>=', $this->tanggalDari))
            ->when($this->tanggalSampai, fn ($q) => $q->whereDate('quotation_date', '<=', $this->tanggalSampai))
            ->when($this->customerId, fn ($q) => $q->where('customer_id', $this->customerId));
    }

    public function exportExcel()
    {
        return Excel::download(
            new LaporanPenjualanExport($this->tanggalDari, $this->tanggalSampai, $this->customerId),
            'laporan-penjualan-' . now()->format('Ymd_His') . '.xlsx'
        );
    }

        public function exportPdf()
    {
        $invoices = $this->filteredInvoices()->get();

        $pdf = Pdf::loadView('laporan.penjualan-pdf', [
            'invoices' => $invoices,
            'tanggalDari' => $this->tanggalDari,
            'tanggalSampai' => $this->tanggalSampai,
        ]);

        $fileName = 'laporan-penjualan-' . now()->format('Ymd_His') . '.pdf';

        return response()->streamDownload(function () use ($pdf) {
            echo $pdf->output();
        }, $fileName);
    }

    public function render()
    {
        $invoices = $this->filteredInvoices()->get();
        $quotations = $this->filteredQuotations()->get();

        return view('livewire.laporan-penjualan', [
            'invoices' => $invoices,
            'customerList' => Customer::orderBy('name')->get(),
            'totalQuotation' => $quotations->count(),
            'nilaiQuotation' => $quotations->sum('grand_total'),
            'quotationApproved' => $quotations->where('status', 'approved')->count(),
            'totalInvoice' => $invoices->count(),
            'nilaiInvoice' => $invoices->sum('grand_total'),
            'totalTerbayar' => $invoices->sum('paid_amount'),
                        'totalPiutang' => $invoices->where('status', '!=', 'cancelled')->sum(fn ($i) => $i->remainingAmount()),
            'invoiceOverdue' => $invoices->where('status', 'overdue')->count(),
        ]);
    }
}