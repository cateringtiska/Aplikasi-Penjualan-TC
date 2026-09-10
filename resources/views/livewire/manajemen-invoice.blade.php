<div>
    <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold text-gray-800">Invoice</h1>
        <a href="{{ route('invoices.create') }}" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            + Buat Invoice
        </a>
    </div>

    @if (session('message'))
        <div class="mb-4 bg-green-100 border border-green-300 text-green-800 px-4 py-3 rounded-lg text-sm">
            {{ session('message') }}
        </div>
    @endif

    <div class="bg-white rounded-lg shadow p-4 mb-4 flex flex-col md:flex-row gap-3">
        <input
            type="text"
            wire:model.live.debounce.400ms="search"
            placeholder="Cari nomor invoice atau nama customer..."
            class="border-gray-300 rounded-lg text-sm flex-1"
        >
        <select wire:model.live="filterStatus" class="border-gray-300 rounded-lg text-sm">
            <option value="">Semua Status</option>
            <option value="unpaid">Belum Dibayar</option>
            <option value="partial">Dibayar Sebagian</option>
            <option value="paid">Lunas</option>
            <option value="overdue">Jatuh Tempo</option>
            <option value="cancelled">Dibatalkan</option>
        </select>
    </div>

    <div class="bg-white rounded-lg shadow overflow-x-auto">
        <table class="min-w-full text-sm">
            <thead class="bg-gray-50 text-gray-600 text-left">
                <tr>
                    <th class="px-4 py-3">No. Invoice</th>
                    <th class="px-4 py-3">Customer</th>
                    <th class="px-4 py-3">Tgl Invoice</th>
                    <th class="px-4 py-3">Jatuh Tempo</th>
                    <th class="px-4 py-3">Total</th>
                    <th class="px-4 py-3">Sisa</th>
                    <th class="px-4 py-3">Status</th>
                    <th class="px-4 py-3">Aksi</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
                @forelse ($invoices as $invoice)
                    <tr>
                        <td class="px-4 py-3 font-medium text-gray-800">{{ $invoice->invoice_number }}</td>
                        <td class="px-4 py-3">{{ $invoice->customer->name }}</td>
                        <td class="px-4 py-3">{{ $invoice->invoice_date->format('d/m/Y') }}</td>
                        <td class="px-4 py-3">{{ $invoice->due_date->format('d/m/Y') }}</td>
                        <td class="px-4 py-3">Rp {{ number_format($invoice->subtotal, 0, ',', '.') }}</td>
                        <td class="px-4 py-3">Rp {{ number_format($invoice->remainingAmount(), 0, ',', '.') }}</td>
                        <td class="px-4 py-3">
                            <span @class([
                                'px-2 py-1 rounded-full text-xs font-medium',
                                'bg-gray-100 text-gray-700' => $invoice->status === 'unpaid',
                                'bg-yellow-100 text-yellow-700' => $invoice->status === 'partial',
                                'bg-green-100 text-green-700' => $invoice->status === 'paid',
                                'bg-red-100 text-red-700' => $invoice->status === 'overdue',
                                'bg-gray-200 text-gray-500' => $invoice->status === 'cancelled',
                            ])>
                                {{ $invoice->statusLabel() }}
                            </span>
                        </td>
                        <td class="px-4 py-3">
                            <div class="flex gap-2 flex-wrap">
                                <a href="{{ route('invoices.show', $invoice->id) }}" class="text-blue-600 hover:underline">Lihat</a>

                                    @if (in_array($invoice->status, ['unpaid', 'partial']))
        <a href="{{ route('invoices.edit', $invoice->id) }}" class="text-indigo-600 hover:underline">Edit</a>
        <button wire:click="batalkan({{ $invoice->id }})" wire:confirm="Batalkan invoice ini?" class="text-orange-600 hover:underline">Batalkan</button>
    @endif

    @if (in_array($invoice->status, ['unpaid', 'partial', 'overdue']))
        <a href="{{ route('payments.create') }}?invoice_id={{ $invoice->id }}" class="text-green-700 hover:underline">Catat Pembayaran</a>
    @endif

                                @if ($invoice->status === 'unpaid')
                                    <button wire:click="hapus({{ $invoice->id }})" wire:confirm="Hapus invoice ini secara permanen?" class="text-red-600 hover:underline">Hapus</button>
                                @endif
                            </div>
                        </td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="8" class="px-4 py-6 text-center text-gray-400">Belum ada data invoice.</td>
                    </tr>
                @endforelse
            </tbody>
        </table>
    </div>

    <div class="mt-4">
        {{ $invoices->links() }}
    </div>
</div>