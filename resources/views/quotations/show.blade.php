<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            Detail Quotation - {{ $quotation->quotation_number }}
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-5xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white overflow-hidden shadow-sm sm:rounded-lg p-6">
                <div class="flex justify-between mb-6">
                    <div>
                        <p><strong>Customer:</strong> {{ $quotation->customer->name }}</p>
                        @if ($quotation->contact_person)
                            <p><strong>UP - Kepada:</strong> {{ $quotation->contact_person }}</p>
                        @endif
                        @if ($quotation->contact_phone)
                            <p><strong>Phone:</strong> {{ $quotation->contact_phone }}</p>
                        @endif
                        <p><strong>Tanggal:</strong> {{ $quotation->quotation_date->format('d/m/Y') }}</p>
                        <p><strong>Berlaku s.d.:</strong> {{ $quotation->valid_until->format('d/m/Y') }}</p>
                        <p><strong>Status:</strong> {{ $quotation->statusLabel() }}</p>
                    </div>
                    <div class="space-x-2">
                        <a href="{{ route('quotations.pdf', $quotation->id) }}" target="_blank" class="bg-indigo-600 text-white px-4 py-2 rounded inline-block">Download PDF</a>
                        <a href="{{ route('quotations.index') }}" class="bg-gray-300 px-4 py-2 rounded inline-block">← Kembali</a>
                    </div>
                </div>

                @if ($quotation->event_date || $quotation->venue || $quotation->guest_count)
                    <div class="mb-6 bg-gray-50 border rounded p-4 grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                        <p><strong>Tanggal Acara:</strong> {{ $quotation->event_date?->format('d/m/Y') ?? '-' }}</p>
                        <p><strong>Jumlah Hari:</strong> {{ $quotation->event_days ?? '-' }}</p>
                        <p><strong>Jenis Acara:</strong> {{ $quotation->event_type ?? '-' }}</p>
                        <p><strong>Jam:</strong> {{ $quotation->event_time ?? '-' }}</p>
                        <p><strong>Jumlah Tamu:</strong> {{ $quotation->guest_count ?? '-' }}</p>
                        <p><strong>F&B Planner:</strong> {{ $quotation->fnb_planner ?? '-' }}</p>
                        <p class="col-span-2 md:col-span-3"><strong>Lokasi:</strong> {{ $quotation->venue ?? '-' }}</p>
                    </div>
                @endif

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
                        @foreach ($quotation->items as $i => $item)
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

                <div class="text-right space-y-1">
                <div>Subtotal: Rp {{ number_format($quotation->subtotal, 0, ',', '.') }}</div>
                @if ($quotation->service_charge_percent)
                <div>Service Charge ({{ rtrim(rtrim(number_format($quotation->service_charge_percent, 2), '0'), '.') }}%): Rp {{ number_format($quotation->service_charge_amount, 0, ',', '.') }}</div>
                @endif
                @if ($quotation->pb1_enabled)
                <div>PB1 ({{ rtrim(rtrim(number_format($quotation->pb1_percent, 2), '0'), '.') }}%): Rp {{ number_format($quotation->pb1_amount, 0, ',', '.') }}</div>
                @endif
                <div class="text-lg font-semibold">Grand Total: Rp {{ number_format($quotation->grand_total, 0, ',', '.') }}</div>
                </div>

                            @if ($quotation->notes)
                <div class="mt-4">
                    <strong>Catatan:</strong>
                    <p>{{ $quotation->notes }}</p>
                </div>
            @endif
            
            @if ($quotation->show_payment_terms && $quotation->payment_terms)
                <div class="mt-4 bg-gray-50 p-4 rounded border">
                    <strong>Syarat & Ketentuan / Termin Pembayaran:</strong>
                    <p class="whitespace-pre-line text-sm mt-1">{{ $quotation->payment_terms }}</p>
                </div>
            @endif
            </div>
        </div>
    </div>
</x-app-layout>