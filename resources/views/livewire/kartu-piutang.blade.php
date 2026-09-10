<div class="p-6">
    <h2 class="text-lg font-semibold mb-4">Kartu Piutang — Daftar Piutang per Customer</h2>

    <div class="mb-6">
        <input type="text" wire:model.live="search" placeholder="Cari nama customer..." class="w-full md:w-96 border rounded px-3 py-2">
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-gray-50 border rounded p-4">
            <p class="text-sm text-gray-500">Belum Jatuh Tempo</p>
            <p class="text-lg font-semibold">Rp {{ number_format($agingBelumJatuhTempo, 0, ',', '.') }}</p>
        </div>
        <div class="bg-yellow-50 border rounded p-4">
            <p class="text-sm text-gray-500">Terlambat 1-30 Hari</p>
            <p class="text-lg font-semibold">Rp {{ number_format($aging1_30, 0, ',', '.') }}</p>
        </div>
        <div class="bg-orange-50 border rounded p-4">
            <p class="text-sm text-gray-500">Terlambat 31-60 Hari</p>
            <p class="text-lg font-semibold">Rp {{ number_format($aging31_60, 0, ',', '.') }}</p>
        </div>
        <div class="bg-red-50 border rounded p-4">
            <p class="text-sm text-gray-500">Terlambat &gt;60 Hari</p>
            <p class="text-lg font-semibold">Rp {{ number_format($aging60plus, 0, ',', '.') }}</p>
        </div>
    </div>

    <div class="mb-4 text-right text-lg font-semibold">
        Total Piutang Keseluruhan: Rp {{ number_format($totalPiutangKeseluruhan, 0, ',', '.') }}
    </div>

    <table class="w-full border-collapse">
        <thead>
            <tr class="bg-gray-100 text-left">
                <th class="p-2 border">Customer</th>
                <th class="p-2 border">Jumlah Invoice Belum Lunas</th>
                <th class="p-2 border">Total Piutang</th>
                <th class="p-2 border">Jatuh Tempo Tertua</th>
                <th class="p-2 border">Umur Piutang</th>
                <th class="p-2 border">Aksi</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($piutangPerCustomer as $row)
                <tr wire:key="piutang-{{ $row['customer']->id }}">
                    <td class="p-2 border">{{ $row['customer']->name }}</td>
                    <td class="p-2 border">{{ $row['jumlah_invoice'] }}</td>
                    <td class="p-2 border font-medium">Rp {{ number_format($row['total_piutang'], 0, ',', '.') }}</td>
                    <td class="p-2 border">{{ $row['jatuh_tempo_tertua']->format('d/m/Y') }}</td>
                    <td class="p-2 border">
                        @if ($row['hari_terlambat'] > 0)
                            <span class="text-red-600 font-medium">Terlambat {{ $row['hari_terlambat'] }} hari</span>
                        @else
                            <span class="text-gray-500">Belum jatuh tempo</span>
                        @endif
                    </td>
                    <td class="p-2 border">
                        <a href="{{ route('customers.histori', $row['customer']->id) }}" class="text-indigo-600 underline">Lihat Detail</a>
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="6" class="p-4 text-center text-gray-500">Tidak ada piutang saat ini — semua invoice sudah lunas atau belum ada invoice.</td>
                </tr>
            @endforelse
        </tbody>
    </table>
</div>