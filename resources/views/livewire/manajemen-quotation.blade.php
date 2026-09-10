<div class="p-6">
    @if (session('message'))
        <div class="mb-4 rounded bg-green-100 p-3 text-green-800">
            {{ session('message') }}
        </div>
    @endif

    <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-semibold">Quotation</h2>
        <a href="{{ route('quotations.create') }}" class="bg-indigo-600 text-white px-4 py-2 rounded inline-block">+ Buat Quotation</a>
    </div>

    <div class="flex gap-3 mb-4">
        <input type="text" wire:model.live="search" placeholder="Cari nomor atau nama customer..." class="flex-1 border rounded px-3 py-2">
        <select wire:model.live="filterStatus" class="border rounded px-3 py-2">
            <option value="">Semua Status</option>
            <option value="draft">Draft</option>
            <option value="sent">Terkirim</option>
            <option value="approved">Disetujui</option>
            <option value="rejected">Ditolak</option>
            <option value="expired">Kadaluarsa</option>
        </select>
    </div>

    <table class="w-full border-collapse">
        <thead>
            <tr class="bg-gray-100 text-left">
                <th class="p-2 border">No. Quotation</th>
                <th class="p-2 border">Customer</th>
                <th class="p-2 border">Tanggal</th>
                <th class="p-2 border">Berlaku s.d.</th>
                <th class="p-2 border">Total</th>
                <th class="p-2 border">Status</th>
                <th class="p-2 border">Aksi</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($quotations as $quotation)
                <tr>
                    <td class="p-2 border">{{ $quotation->quotation_number }}</td>
                    <td class="p-2 border">{{ $quotation->customer->name }}</td>
                    <td class="p-2 border">{{ $quotation->quotation_date->format('d/m/Y') }}</td>
                    <td class="p-2 border">{{ $quotation->valid_until->format('d/m/Y') }}</td>
                    <td class="p-2 border">Rp {{ number_format($quotation->subtotal, 0, ',', '.') }}</td>
                    <td class="p-2 border">
                        <span @class([
                            'px-2 py-1 rounded text-xs font-medium',
                            'bg-gray-200 text-gray-700' => $quotation->status === 'draft',
                            'bg-blue-100 text-blue-700' => $quotation->status === 'sent',
                            'bg-green-100 text-green-700' => $quotation->status === 'approved',
                            'bg-red-100 text-red-700' => $quotation->status === 'rejected',
                            'bg-yellow-100 text-yellow-700' => $quotation->status === 'expired',
                        ])>
                            {{ $quotation->statusLabel() }}
                        </span>
                    </td>
                    <td class="p-2 border space-x-2 whitespace-nowrap">
                        <a href="{{ route('quotations.show', $quotation->id) }}" class="text-indigo-600 underline">Detail</a>
                        @if ($quotation->status === 'draft')
                            <a href="{{ route('quotations.edit', $quotation->id) }}" class="text-indigo-600 underline">Edit</a>
                            <button wire:click="kirim({{ $quotation->id }})" class="text-indigo-600 underline">Kirim</button>
                            <button wire:click="hapus({{ $quotation->id }})" wire:confirm="Yakin hapus quotation ini?" class="text-red-600 underline">Hapus</button>
                        @endif
                        @if ($quotation->status === 'sent')
                            <button wire:click="setujui({{ $quotation->id }})" class="text-green-700 underline">Setujui</button>
                            <button wire:click="tolak({{ $quotation->id }})" class="text-red-600 underline">Tolak</button>
                        @endif
                        @if ($quotation->status === 'approved')
    @if ($quotation->invoice)
        <a href="{{ route('invoices.show', $quotation->invoice->id) }}" class="text-green-600 hover:underline">Lihat Invoice</a>
    @else
        <a href="{{ route('invoices.create') }}?from_quotation={{ $quotation->id }}" class="text-blue-600 hover:underline">Konversi ke Invoice</a>
    @endif
@endif
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="7" class="p-4 text-center text-gray-500">Belum ada data quotation.</td>
                </tr>
            @endforelse
        </tbody>
    </table>
</div>