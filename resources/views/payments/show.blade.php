<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            Detail Pembayaran - {{ $payment->payment_number }}
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-4xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white overflow-hidden shadow-sm sm:rounded-lg p-6">
                <div class="mb-6">
                    <p><strong>Customer:</strong> {{ $payment->customer->name }}</p>
                    <p><strong>Tanggal:</strong> {{ $payment->payment_date->format('d/m/Y') }}</p>
                    <p><strong>Metode:</strong> {{ $payment->methodLabel() }}</p>
                    <p><strong>Bank/Kas:</strong> {{ $payment->bank_cash ?: '-' }}</p>
                    <p><strong>Total Diterima:</strong> Rp {{ number_format($payment->total_amount, 0, ',', '.') }}</p>
                </div>

                <h3 class="font-semibold mb-2">Dialokasikan ke Invoice</h3>
                <table class="w-full border-collapse mb-4">
                    <thead>
                        <tr class="bg-gray-100 text-left">
                            <th class="p-2 border">No. Invoice</th>
                            <th class="p-2 border">Total Invoice</th>
                            <th class="p-2 border">Jumlah Dialokasikan</th>
                            <th class="p-2 border">Status Invoice Sekarang</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($payment->details as $detail)
                            <tr>
                                <td class="p-2 border">
                                    <a href="{{ route('invoices.show', $detail->invoice_id) }}" class="text-indigo-600 underline">{{ $detail->invoice->invoice_number }}</a>
                                </td>
                                <td class="p-2 border">Rp {{ number_format($detail->invoice->subtotal, 0, ',', '.') }}</td>
                                <td class="p-2 border">Rp {{ number_format($detail->amount_applied, 0, ',', '.') }}</td>
                                <td class="p-2 border">{{ $detail->invoice->statusLabel() }}</td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>

                @if ($payment->notes)
                    <div class="mb-4">
                        <strong>Catatan:</strong>
                        <p>{{ $payment->notes }}</p>
                    </div>
                @endif

                <a href="{{ route('payments.index') }}" class="bg-gray-300 px-4 py-2 rounded inline-block">← Kembali</a>
            </div>
        </div>
    </div>
</x-app-layout>