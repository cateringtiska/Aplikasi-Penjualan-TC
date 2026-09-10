<div class="p-6">
    <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 class="text-lg font-semibold">Dashboard</h2>

        <div class="flex flex-wrap gap-2">
            <a href="{{ route('quotations.create') }}" class="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700">
                + Buat Quotation
            </a>
            <a href="{{ route('invoices.create') }}" class="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700">
                + Buat Invoice
            </a>
            @if (in_array(auth()->user()->role, ['admin', 'finance']))
                <a href="{{ route('reports.margin') }}" class="bg-gray-700 text-white px-4 py-2 rounded text-sm hover:bg-gray-800">
                    Laporan Margin
                </a>
            @endif
            @if (auth()->user()->role === 'admin')
                <a href="{{ route('settings.company') }}" class="bg-gray-200 text-gray-800 px-4 py-2 rounded text-sm hover:bg-gray-300">
                    ⚙ Pengaturan
                </a>
            @endif
        </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <a href="{{ route('reports.piutang') }}" class="block bg-red-50 border rounded p-4 hover:bg-red-100">
            <p class="text-sm text-gray-500">Total Piutang Belum Lunas</p>
            <p class="text-xl font-semibold text-red-600">Rp {{ number_format($totalPiutang, 0, ',', '.') }}</p>
        </a>
        <a href="{{ route('invoices.index') }}" class="block bg-green-50 border rounded p-4 hover:bg-green-100">
            <p class="text-sm text-gray-500">Penjualan Bulan Ini</p>
            <p class="text-xl font-semibold text-green-700">Rp {{ number_format($penjualanBulanIni, 0, ',', '.') }}</p>
        </a>
        <a href="{{ route('quotations.index') }}" class="block bg-blue-50 border rounded p-4 hover:bg-blue-100">
            <p class="text-sm text-gray-500">Quotation Menunggu Tindak Lanjut</p>
            <p class="text-xl font-semibold text-blue-700">{{ $quotationMenunggu }}</p>
        </a>
        <a href="{{ route('invoices.index') }}" class="block bg-orange-50 border rounded p-4 hover:bg-orange-100">
            <p class="text-sm text-gray-500">Invoice Jatuh Tempo</p>
            <p class="text-xl font-semibold text-orange-700">{{ $invoiceJatuhTempo }}</p>
        </a>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
            <h3 class="font-semibold mb-2">Quotation Terbaru</h3>
            <table class="w-full border-collapse">
                <thead>
                    <tr class="bg-gray-100 text-left">
                        <th class="p-2 border">No. Quotation</th>
                        <th class="p-2 border">Customer</th>
                        <th class="p-2 border">Status</th>
                        <th class="p-2 border">Total</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse ($quotationTerbaru as $quotation)
                        <tr>
                            <td class="p-2 border"><a href="{{ route('quotations.show', $quotation->id) }}" class="text-indigo-600 underline">{{ $quotation->quotation_number }}</a></td>
                            <td class="p-2 border">{{ $quotation->customer->name }}</td>
                            <td class="p-2 border">{{ $quotation->statusLabel() }}</td>
                            <td class="p-2 border">Rp {{ number_format($quotation->grand_total, 0, ',', '.') }}</td>
                        </tr>
                    @empty
                        <tr><td colspan="4" class="p-4 text-center text-gray-500">Belum ada Quotation.</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>

        <div>
            <h3 class="font-semibold mb-2">Invoice Terbaru</h3>
            <table class="w-full border-collapse">
                <thead>
                    <tr class="bg-gray-100 text-left">
                        <th class="p-2 border">No. Invoice</th>
                        <th class="p-2 border">Customer</th>
                        <th class="p-2 border">Status</th>
                        <th class="p-2 border">Sisa</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse ($invoiceTerbaru as $invoice)
                        <tr>
                            <td class="p-2 border"><a href="{{ route('invoices.show', $invoice->id) }}" class="text-indigo-600 underline">{{ $invoice->invoice_number }}</a></td>
                            <td class="p-2 border">{{ $invoice->customer->name }}</td>
                            <td class="p-2 border">{{ $invoice->statusLabel() }}</td>
                            <td class="p-2 border">Rp {{ number_format($invoice->remainingAmount(), 0, ',', '.') }}</td>
                        </tr>
                    @empty
                        <tr><td colspan="4" class="p-4 text-center text-gray-500">Belum ada Invoice.</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>
</div>