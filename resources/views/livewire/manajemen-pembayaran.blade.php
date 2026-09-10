<div class="p-6">
    @if (session('message'))
        <div class="mb-4 rounded bg-green-100 p-3 text-green-800">
            {{ session('message') }}
        </div>
    @endif

    <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-semibold">Pembayaran</h2>
        <a href="{{ route('payments.create') }}" class="bg-indigo-600 text-white px-4 py-2 rounded inline-block">+ Catat Pembayaran</a>
    </div>

    <input type="text" wire:model.live="search" placeholder="Cari nomor pembayaran atau nama customer..." class="w-full border rounded px-3 py-2 mb-4">

    <table class="w-full border-collapse">
        <thead>
            <tr class="bg-gray-100 text-left">
                <th class="p-2 border">No. Pembayaran</th>
                <th class="p-2 border">Tanggal</th>
                <th class="p-2 border">Customer</th>
                <th class="p-2 border">Metode</th>
                <th class="p-2 border">Total</th>
                <th class="p-2 border">Aksi</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($payments as $payment)
                <tr>
                    <td class="p-2 border">{{ $payment->payment_number }}</td>
                    <td class="p-2 border">{{ $payment->payment_date->format('d/m/Y') }}</td>
                    <td class="p-2 border">{{ $payment->customer->name }}</td>
                    <td class="p-2 border">{{ $payment->methodLabel() }}</td>
                    <td class="p-2 border">Rp {{ number_format($payment->total_amount, 0, ',', '.') }}</td>
                    <td class="p-2 border space-x-2 whitespace-nowrap">
                        <a href="{{ route('payments.show', $payment->id) }}" class="text-indigo-600 underline">Detail</a>
                        <button wire:click="hapus({{ $payment->id }})" wire:confirm="Yakin hapus pembayaran ini? Status invoice terkait akan disesuaikan kembali." class="text-red-600 underline">Hapus</button>
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="6" class="p-4 text-center text-gray-500">Belum ada data pembayaran.</td>
                </tr>
            @endforelse
        </tbody>
    </table>
</div>