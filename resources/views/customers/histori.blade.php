<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            Histori Transaksi - {{ $customer->name }}
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white overflow-hidden shadow-sm sm:rounded-lg p-6">
                <table class="w-full mb-6">
                    <tr><td class="font-semibold pr-4 py-1">Kode Customer</td><td>{{ $customer->customer_code }}</td></tr>
                    <tr><td class="font-semibold pr-4 py-1">Nama</td><td>{{ $customer->name }}</td></tr>
                    <tr><td class="font-semibold pr-4 py-1">PIC</td><td>{{ $customer->pic_name ?: '-' }}</td></tr>
                    <tr><td class="font-semibold pr-4 py-1">Telepon</td><td>{{ $customer->phone ?: '-' }}</td></tr>
                    <tr><td class="font-semibold pr-4 py-1">Email</td><td>{{ $customer->email ?: '-' }}</td></tr>
                    <tr><td class="font-semibold pr-4 py-1">Alamat</td><td>{{ $customer->address ?: '-' }}</td></tr>
                </table>

                <div class="mb-6 bg-gray-50 border rounded p-4 flex justify-between items-center">
                    <span class="font-semibold">Total Piutang Saat Ini (Belum Lunas)</span>
                    <span class="text-lg font-semibold {{ $totalPiutang > 0 ? 'text-red-600' : 'text-green-700' }}">
                        Rp {{ number_format($totalPiutang, 0, ',', '.') }}
                    </span>
                </div>

                <h3 class="font-semibold text-lg mb-2">Riwayat Quotation</h3>
                @if ($quotations->isEmpty())
                    <p class="text-gray-500 mb-6">Belum ada Quotation untuk customer ini.</p>
                @else
                    <table class="w-full border-collapse mb-6">
                        <thead>
                            <tr class="bg-gray-100 text-left">
                                <th class="p-2 border">No. Quotation</th>
                                <th class="p-2 border">Tanggal</th>
                                <th class="p-2 border">Berlaku s.d.</th>
                                <th class="p-2 border">Status</th>
                                <th class="p-2 border">Grand Total</th>
                                <th class="p-2 border">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($quotations as $quotation)
                                <tr>
                                    <td class="p-2 border">{{ $quotation->quotation_number }}</td>
                                    <td class="p-2 border">{{ $quotation->quotation_date->format('d/m/Y') }}</td>
                                    <td class="p-2 border">{{ $quotation->valid_until->format('d/m/Y') }}</td>
                                    <td class="p-2 border">{{ $quotation->statusLabel() }}</td>
                                    <td class="p-2 border">Rp {{ number_format($quotation->grand_total, 0, ',', '.') }}</td>
                                    <td class="p-2 border">
                                        <a href="{{ route('quotations.show', $quotation->id) }}" class="text-indigo-600 underline">Detail</a>
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                @endif

                <h3 class="font-semibold text-lg mb-2">Riwayat Invoice</h3>
                @if ($invoices->isEmpty())
                    <p class="text-gray-500">Belum ada Invoice untuk customer ini.</p>
                @else
                    <table class="w-full border-collapse">
                        <thead>
                            <tr class="bg-gray-100 text-left">
                                <th class="p-2 border">No. Invoice</th>
                                <th class="p-2 border">Tanggal</th>
                                <th class="p-2 border">Jatuh Tempo</th>
                                <th class="p-2 border">Status</th>
                                <th class="p-2 border">Grand Total</th>
                                <th class="p-2 border">Terbayar</th>
                                <th class="p-2 border">Sisa</th>
                                <th class="p-2 border">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($invoices as $invoice)
                                <tr>
                                    <td class="p-2 border">{{ $invoice->invoice_number }}</td>
                                    <td class="p-2 border">{{ $invoice->invoice_date->format('d/m/Y') }}</td>
                                    <td class="p-2 border">{{ $invoice->due_date->format('d/m/Y') }}</td>
                                    <td class="p-2 border">{{ $invoice->statusLabel() }}</td>
                                    <td class="p-2 border">Rp {{ number_format($invoice->grand_total, 0, ',', '.') }}</td>
                                    <td class="p-2 border">Rp {{ number_format($invoice->paid_amount, 0, ',', '.') }}</td>
                                    <td class="p-2 border">Rp {{ number_format($invoice->remainingAmount(), 0, ',', '.') }}</td>
                                    <td class="p-2 border">
                                        <a href="{{ route('invoices.show', $invoice->id) }}" class="text-indigo-600 underline">Detail</a>
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                @endif

                <a href="{{ route('customers.index') }}" class="inline-block mt-6 text-indigo-600 underline">&larr; Kembali ke Daftar Customer</a>
            </div>
        </div>
    </div>
</x-app-layout>