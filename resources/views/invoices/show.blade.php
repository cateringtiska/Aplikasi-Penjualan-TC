<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            Detail Invoice - {{ $invoice->invoice_number }}
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-screen-2xl mx-auto sm:px-6 lg:px-8">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <div class="bg-white overflow-hidden shadow-sm sm:rounded-lg p-6">
                    <div class="flex justify-between mb-6">
                        <div>
                            <p><strong>Customer:</strong> {{ $invoice->customer->name }}</p>
                            @if ($invoice->contact_person)
                                <p><strong>UP - Kepada:</strong> {{ $invoice->contact_person }}</p>
                            @endif
                            @if ($invoice->contact_phone)
                                <p><strong>Phone:</strong> {{ $invoice->contact_phone }}</p>
                            @endif
                            <p><strong>Tanggal Invoice:</strong> {{ $invoice->invoice_date->format('d/m/Y') }}</p>
                            <p><strong>Jatuh Tempo:</strong> {{ $invoice->due_date->format('d/m/Y') }}</p>
                            <p><strong>Status:</strong> {{ $invoice->statusLabel() }}</p>
                            @if ($invoice->quotation)
                                <p><strong>Dari Quotation:</strong> {{ $invoice->quotation->quotation_number }}</p>
                            @endif
                        </div>
                        <div class="space-x-2">
                            <a href="{{ route('invoices.pdf', $invoice->id) }}" target="_blank" class="bg-indigo-600 text-white px-4 py-2 rounded inline-block">Download PDF</a>
                            <a href="{{ route('invoices.index') }}" class="bg-gray-300 px-4 py-2 rounded inline-block">← Kembali</a>
                        </div>
                    </div>

                    @if ($invoice->event_date || $invoice->venue || $invoice->guest_count)
                        <div class="mb-6 bg-gray-50 border rounded p-4 grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                            <p><strong>Tanggal Acara:</strong> {{ $invoice->event_date?->format('d/m/Y') ?? '-' }}</p>
                            <p><strong>Jumlah Hari:</strong> {{ $invoice->event_days ?? '-' }}</p>
                            <p><strong>Jenis Acara:</strong> {{ $invoice->event_type ?? '-' }}</p>
                            <p><strong>Jam:</strong> {{ $invoice->event_time ?? '-' }}</p>
                            <p><strong>Jumlah Tamu:</strong> {{ $invoice->guest_count ?? '-' }}</p>
                            <p><strong>F&B Planner:</strong> {{ $invoice->fnb_planner ?? '-' }}</p>
                            <p class="col-span-2 md:col-span-3"><strong>Lokasi:</strong> {{ $invoice->venue ?? '-' }}</p>
                        </div>
                    @endif

                    <div class="overflow-x-auto">
                        <table class="w-full border-collapse mb-4">
                            <thead>
                                <tr class="bg-gray-100 text-left">
                                    <th class="p-2 border w-10">No</th>
                                    <th class="p-2 border">Deskripsi</th>
                                    <th class="p-2 border">Qty</th>
                                    <th class="p-2 border">Satuan</th>
                                    <th class="p-2 border">Harga</th>
                                    <th class="p-2 border">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                @foreach ($invoice->items as $i => $item)
                                    <tr>
                                        <td class="p-2 border align-top">{{ \App\Support\RomanNumeral::convert($i + 1) }}</td>
                                        <td class="p-2 border align-top">
                                            {{ $item->item_name }}
                                            @if ($item->children->isNotEmpty())
                                                <ul class="text-sm text-gray-500 mt-1 ml-4 list-disc">
                                                    @foreach ($item->children as $child)
                                                        <li>{{ $child->item_name }}</li>
                                                    @endforeach
                                                </ul>
                                            @endif
                                        </td>
                                        <td class="p-2 border align-top">{{ $item->qty }}</td>
                                        <td class="p-2 border align-top">{{ $item->unit }}</td>
                                        <td class="p-2 border align-top">
                                            @if ($item->is_compliment)
                                                <em>Compliment</em>
                                            @else
                                                Rp {{ number_format($item->price, 0, ',', '.') }}
                                            @endif
                                        </td>
                                        <td class="p-2 border align-top">
                                            @if ($item->is_compliment)
                                                <em>Compliment</em>
                                            @else
                                                Rp {{ number_format($item->subtotal, 0, ',', '.') }}
                                            @endif
                                        </td>
                                    </tr>
                                @endforeach
                            </tbody>
                        </table>
                    </div>

                    <div class="text-right space-y-1">
                    <div>Subtotal: Rp {{ number_format($invoice->subtotal, 0, ',', '.') }}</div>
                    @if ($invoice->service_charge_percent)
                    <div>Service Charge ({{ rtrim(rtrim(number_format($invoice->service_charge_percent, 2), '0'), '.') }}%): Rp {{ number_format($invoice->service_charge_amount, 0, ',', '.') }}</div>
                    @endif
                    @if ($invoice->pb1_enabled)
                    <div>PB1 ({{ rtrim(rtrim(number_format($invoice->pb1_percent, 2), '0'), '.') }}%): Rp {{ number_format($invoice->pb1_amount, 0, ',', '.') }}</div>
                    @endif
                    <div>Grand Total: <strong>Rp {{ number_format($invoice->grand_total, 0, ',', '.') }}</strong></div>
                    <div>Terbayar: Rp {{ number_format($invoice->paid_amount, 0, ',', '.') }}</div>
                    <div class="text-lg font-semibold">Sisa Tagihan: Rp {{ number_format($invoice->remainingAmount(), 0, ',', '.') }}</div>
                    </div>
                                @if ($invoice->notes)
                    <div class="mt-4">
                        <strong>Catatan:</strong>
                        <p>{{ $invoice->notes }}</p>
                    </div>
                @endif

                @if ($invoice->show_payment_terms && $invoice->payment_terms)
                    <div class="mt-4 bg-gray-50 p-4 rounded border">
                        <strong>Termin Pembayaran:</strong>
                        <p class="whitespace-pre-line text-sm mt-1">{{ $invoice->payment_terms }}</p>
                    </div>
                @endif
                </div>

                <div class="bg-white overflow-hidden shadow-sm sm:rounded-lg p-6">
                    <livewire:invoice-margin :invoice="$invoice" />
                </div>
            </div>
        </div>
    </div>
</x-app-layout>