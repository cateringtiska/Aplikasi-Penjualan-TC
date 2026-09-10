<div class="p-6">
    <h2 class="text-lg font-semibold mb-4">Laporan Penjualan</h2>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 bg-gray-50 p-4 rounded border">
        <div>
            <label class="block text-sm mb-1">Tanggal Dari</label>
            <input type="date" wire:model.live="tanggalDari" class="w-full border rounded px-3 py-2">
        </div>
        <div>
            <label class="block text-sm mb-1">Tanggal Sampai</label>
            <input type="date" wire:model.live="tanggalSampai" class="w-full border rounded px-3 py-2">
        </div>
        <div>
            <label class="block text-sm mb-1">Customer</label>
            <select wire:model.live="customerId" class="w-full border rounded px-3 py-2">
                <option value="">-- Semua Customer --</option>
                @foreach ($customerList as $customer)
                    <option value="{{ $customer->id }}">{{ $customer->name }}</option>
                @endforeach
            </select>
        </div>
        <div class="flex items-end">
            <button type="button" wire:click="resetFilter" class="bg-gray-300 px-4 py-2 rounded w-full">Reset Filter</button>
        </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div class="bg-white border rounded p-4">
            <p class="text-sm text-gray-500">Quotation Dibuat</p>
            <p class="text-xl font-semibold">{{ $totalQuotation }}</p>
            <p class="text-xs text-gray-500">Rp {{ number_format($nilaiQuotation, 0, ',', '.') }}</p>
        </div>
        <div class="bg-white border rounded p-4">
            <p class="text-sm text-gray-500">Quotation Disetujui</p>
            <p class="text-xl font-semibold">{{ $quotationApproved }}</p>
            <p class="text-xs text-gray-500">dari {{ $totalQuotation }} quotation</p>
        </div>
        <div class="bg-white border rounded p-4">
            <p class="text-sm text-gray-500">Invoice Diterbitkan</p>
            <p class="text-xl font-semibold">{{ $totalInvoice }}</p>
            <p class="text-xs text-gray-500">Rp {{ number_format($nilaiInvoice, 0, ',', '.') }}</p>
        </div>
        <div class="bg-white border rounded p-4">
            <p class="text-sm text-gray-500">Invoice Jatuh Tempo</p>
            <p class="text-xl font-semibold text-red-600">{{ $invoiceOverdue }}</p>
        </div>
        <div class="bg-white border rounded p-4">
            <p class="text-sm text-gray-500">Total Sudah Dibayar</p>
            <p class="text-xl font-semibold text-green-700">Rp {{ number_format($totalTerbayar, 0, ',', '.') }}</p>
        </div>
        <div class="bg-white border rounded p-4">
            <p class="text-sm text-gray-500">Total Piutang</p>
            <p class="text-xl font-semibold text-orange-600">Rp {{ number_format($totalPiutang, 0, ',', '.') }}</p>
        </div>
    </div>

    <div class="flex justify-between items-center mb-4">
        <h3 class="font-semibold">Detail Invoice</h3>
        <div class="space-x-2">
            <button wire:click="exportExcel" class="bg-green-600 text-white px-4 py-2 rounded">Export Excel</button>
            <button wire:click="exportPdf" class="bg-red-600 text-white px-4 py-2 rounded">Export PDF</button>
        </div>
    </div>

    <table class="w-full border-collapse">
        <thead>
            <tr class="bg-gray-100 text-left">
                <th class="p-2 border">No. Invoice</th>
                <th class="p-2 border">Tanggal</th>
                <th class="p-2 border">Customer</th>
                <th class="p-2 border">Jatuh Tempo</th>
                <th class="p-2 border">Total</th>
                <th class="p-2 border">Terbayar</th>
                <th class="p-2 border">Sisa</th>
                <th class="p-2 border">Status</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($invoices as $invoice)
                <tr>
                    <td class="p-2 border">{{ $invoice->invoice_number }}</td>
                    <td class="p-2 border">{{ $invoice->invoice_date->format('d/m/Y') }}</td>
                    <td class="p-2 border">{{ $invoice->customer->name }}</td>
                    <td class="p-2 border">{{ $invoice->due_date->format('d/m/Y') }}</td>
                    <td class="p-2 border">Rp {{ number_format($invoice->grand_total, 0, ',', '.') }}</td>
                    <td class="p-2 border">Rp {{ number_format($invoice->paid_amount, 0, ',', '.') }}</td>
                    <td class="p-2 border">Rp {{ number_format($invoice->remainingAmount(), 0, ',', '.') }}</td>
                    <td class="p-2 border">{{ $invoice->statusLabel() }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="8" class="p-4 text-center text-gray-500">Tidak ada data invoice untuk filter ini.</td>
                </tr>
            @endforelse
        </tbody>
    </table>
</div>