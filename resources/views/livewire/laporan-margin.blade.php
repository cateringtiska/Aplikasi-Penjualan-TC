<div class="p-6">
    <h2 class="text-lg font-semibold mb-6">Laporan Margin per Event</h2>

    <input type="text" wire:model.live="search" placeholder="Cari nomor invoice atau nama customer..." class="w-full border rounded px-3 py-2 mb-6">

    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-gray-50 border rounded p-4">
            <p class="text-sm text-gray-500">Total Net Sales</p>
            <p class="text-lg font-semibold">Rp {{ number_format($totalNetSales, 0, ',', '.') }}</p>
        </div>
        <div class="bg-gray-50 border rounded p-4">
            <p class="text-sm text-gray-500">Total Biaya</p>
            <p class="text-lg font-semibold">Rp {{ number_format($totalCost, 0, ',', '.') }}</p>
        </div>
        <div class="border rounded p-4 {{ $totalProfit >= 0 ? 'bg-green-50' : 'bg-red-50' }}">
            <p class="text-sm text-gray-500">Total Profit</p>
            <p class="text-lg font-semibold {{ $totalProfit >= 0 ? 'text-green-700' : 'text-red-700' }}">Rp {{ number_format(abs($totalProfit), 0, ',', '.') }}</p>
        </div>
        <div class="border rounded p-4 {{ $totalProfit >= 0 ? 'bg-green-50' : 'bg-red-50' }}">
            <p class="text-sm text-gray-500">Margin Rata-rata</p>
            <p class="text-lg font-semibold {{ $totalProfit >= 0 ? 'text-green-700' : 'text-red-700' }}">{{ number_format($avgMarginPercent, 2) }}%</p>
        </div>
    </div>

    <table class="w-full border-collapse">
        <thead>
            <tr class="bg-gray-100 text-left">
                <th class="p-2 border">No. Invoice</th>
                <th class="p-2 border">Customer</th>
                <th class="p-2 border">Tgl Invoice</th>
                <th class="p-2 border">Net Sales</th>
                <th class="p-2 border">Total Biaya</th>
                <th class="p-2 border">Profit/Rugi</th>
                <th class="p-2 border">Margin %</th>
                <th class="p-2 border">Status</th>
                <th class="p-2 border">Aksi</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($invoices as $invoice)
                <tr>
                    <td class="p-2 border">{{ $invoice->invoice_number }}</td>
                    <td class="p-2 border">{{ $invoice->customer->name }}</td>
                    <td class="p-2 border">{{ $invoice->invoice_date->format('d/m/Y') }}</td>
                    @if ($invoice->margin)
                        <td class="p-2 border">Rp {{ number_format($invoice->margin->net_sales, 0, ',', '.') }}</td>
                        <td class="p-2 border">Rp {{ number_format($invoice->margin->total_cost, 0, ',', '.') }}</td>
                        <td class="p-2 border {{ $invoice->margin->profit_status === 'untung' ? 'text-green-700' : 'text-red-700' }}">
                            Rp {{ number_format(abs($invoice->margin->profit), 0, ',', '.') }}
                        </td>
                        <td class="p-2 border {{ $invoice->margin->profit_status === 'untung' ? 'text-green-700' : 'text-red-700' }}">
                            {{ number_format($invoice->margin->margin_percent, 2) }}%
                        </td>
                        <td class="p-2 border">
                            <span class="px-2 py-1 rounded text-xs font-semibold {{ $invoice->margin->status === 'final' ? 'bg-indigo-100 text-indigo-700' : 'bg-yellow-100 text-yellow-700' }}">
                                {{ $invoice->margin->status === 'final' ? 'Final' : 'Draft' }}
                            </span>
                        </td>
                    @else
                        <td class="p-2 border text-gray-400" colspan="4">Belum diisi biaya</td>
                    @endif
                    <td class="p-2 border"><a href="{{ route('invoices.show', $invoice->id) }}" class="text-indigo-600 underline">Lihat Detail</a></td>
                </tr>
            @empty
                <tr><td colspan="9" class="p-4 text-center text-gray-500">Belum ada Invoice.</td></tr>
            @endforelse
        </tbody>
    </table>
</div>