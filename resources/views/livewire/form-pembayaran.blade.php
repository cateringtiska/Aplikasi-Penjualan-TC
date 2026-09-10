<div class="p-6">
    <h2 class="text-lg font-semibold mb-4">Catat Pembayaran</h2>

    <form wire:submit="simpan">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-gray-50 p-4 rounded border">
            <div>
                <label class="block text-sm mb-1">Customer</label>
                <select wire:model.live="customer_id" class="w-full border rounded px-3 py-2">
                    <option value="">-- Pilih Customer --</option>
                    @foreach ($customerList as $customer)
                        <option value="{{ $customer->id }}">{{ $customer->name }} ({{ $customer->customer_code }})</option>
                    @endforeach
                </select>
                @error('customer_id') <span class="text-red-600 text-sm">{{ $message }}</span> @enderror
            </div>
            <div>
                <label class="block text-sm mb-1">Tanggal Pembayaran</label>
                <input type="date" wire:model="payment_date" class="w-full border rounded px-3 py-2">
                @error('payment_date') <span class="text-red-600 text-sm">{{ $message }}</span> @enderror
            </div>
            <div>
                <label class="block text-sm mb-1">Metode Bayar</label>
                <select wire:model="payment_method" class="w-full border rounded px-3 py-2">
                    <option value="cash">Tunai</option>
                    <option value="transfer">Transfer Bank</option>
                    <option value="giro">Giro</option>
                    <option value="lainnya">Lainnya</option>
                </select>
            </div>
            <div>
                <label class="block text-sm mb-1">Bank / Kas Penerima</label>
                <input type="text" wire:model="bank_cash" placeholder="misal: BCA 1234567890" class="w-full border rounded px-3 py-2">
            </div>
            <div>
                <label class="block text-sm mb-1">Total Pembayaran Diterima</label>
                <input type="number" step="0.01" wire:model.live="total_amount" class="w-full border rounded px-3 py-2">
                @error('total_amount') <span class="text-red-600 text-sm">{{ $message }}</span> @enderror
            </div>
            <div class="md:col-span-3">
                <label class="block text-sm mb-1">Catatan (opsional)</label>
                <textarea wire:model="notes" class="w-full border rounded px-3 py-2" rows="2"></textarea>
            </div>
        </div>

        @if ($customer_id)
            <h3 class="font-semibold mb-2">Alokasikan ke Invoice</h3>

            @if (empty($outstandingInvoices))
                <p class="text-gray-500 mb-4">Customer ini tidak punya invoice yang belum lunas.</p>
            @else
                <table class="w-full border-collapse mb-2">
                    <thead>
                        <tr class="bg-gray-100 text-left">
                            <th class="p-2 border"></th>
                            <th class="p-2 border">No. Invoice</th>
                            <th class="p-2 border">Jatuh Tempo</th>
                            <th class="p-2 border">Sisa Tagihan</th>
                            <th class="p-2 border">Jumlah Dibayar</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($outstandingInvoices as $index => $row)
                            <tr wire:key="inv-{{ $row['invoice_id'] }}">
                                <td class="p-2 border text-center">
                                    <input type="checkbox" wire:model.live="outstandingInvoices.{{ $index }}.checked">
                                </td>
                                <td class="p-2 border">{{ $row['invoice_number'] }}</td>
                                <td class="p-2 border">{{ $row['due_date'] }}</td>
                                <td class="p-2 border">Rp {{ number_format($row['sisa'], 0, ',', '.') }}</td>
                                <td class="p-2 border">
                                    <input type="number" step="0.01" wire:model.live="outstandingInvoices.{{ $index }}.amount" class="w-32 border rounded px-2 py-1">
                                </td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>

                <div class="text-right mb-6">
                    Total Dialokasikan: <strong>Rp {{ number_format(collect($outstandingInvoices)->filter(fn($r) => $r['checked'])->sum(fn($r) => (float) ($r['amount'] ?? 0)), 0, ',', '.') }}</strong>
                </div>
            @endif
        @endif

        <div class="flex gap-2">
            <button type="submit" class="bg-indigo-600 text-white px-6 py-2 rounded">Simpan Pembayaran</button>
            <a href="{{ route('payments.index') }}" class="bg-gray-300 px-6 py-2 rounded inline-block">Batal</a>
        </div>
    </form>
</div>