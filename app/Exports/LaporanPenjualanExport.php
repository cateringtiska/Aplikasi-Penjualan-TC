<?php

namespace App\Exports;

use App\Models\Invoice;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Illuminate\Support\Collection;

class LaporanPenjualanExport implements FromCollection, WithHeadings, WithMapping
{
    public function __construct(
        protected ?string $tanggalDari,
        protected ?string $tanggalSampai,
        protected $customerId,
    ) {}

        public function collection(): Collection
    {
        return Invoice::with('customer')
            ->when($this->tanggalDari, fn ($q) => $q->whereDate('invoice_date', '>=', $this->tanggalDari))
            ->when($this->tanggalSampai, fn ($q) => $q->whereDate('invoice_date', '<=', $this->tanggalSampai))
            ->when($this->customerId, fn ($q) => $q->where('customer_id', $this->customerId))
            ->orderBy('invoice_date')
            ->get();
    }

    public function headings(): array
    {
        return ['No. Invoice', 'Tanggal', 'Customer', 'Jatuh Tempo', 'Total', 'Terbayar', 'Sisa', 'Status'];
    }

    public function map($invoice): array
    {
        return [
            $invoice->invoice_number,
            $invoice->invoice_date->format('d/m/Y'),
            $invoice->customer->name,
            $invoice->due_date->format('d/m/Y'),
            $invoice->grand_total,
            $invoice->paid_amount,
            $invoice->remainingAmount(),
            $invoice->statusLabel(),
        ];
    }
}