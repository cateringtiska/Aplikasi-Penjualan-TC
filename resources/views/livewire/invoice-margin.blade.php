<div>
    <h3 class="text-lg font-semibold mb-4">Biaya & Analisis Margin</h3>

    @if (session('margin_message'))
        <div class="mb-4 rounded bg-green-100 p-3 text-green-800">{{ session('margin_message') }}</div>
    @endif
    @if (session('margin_error'))
        <div class="mb-4 rounded bg-red-100 p-3 text-red-800">{{ session('margin_error') }}</div>
    @endif

    {{-- Ringkasan Margin --}}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div class="bg-gray-50 border rounded p-4">
            <p class="text-sm text-gray-500">Net Sales</p>
            <p class="text-lg font-semibold">Rp {{ number_format($margin->net_sales, 0, ',', '.') }}</p>
        </div>
        <div class="bg-gray-50 border rounded p-4">
            <p class="text-sm text-gray-500">Total Biaya</p>
            <p class="text-lg font-semibold">Rp {{ number_format($margin->total_cost, 0, ',', '.') }}</p>
        </div>
        <div class="border rounded p-4 {{ $margin->profit_status === 'untung' ? 'bg-green-50' : 'bg-red-50' }}">
            <p class="text-sm text-gray-500">{{ $margin->profit_status === 'untung' ? 'Profit' : 'Rugi' }}</p>
            <p class="text-lg font-semibold {{ $margin->profit_status === 'untung' ? 'text-green-700' : 'text-red-700' }}">
                Rp {{ number_format(abs($margin->profit), 0, ',', '.') }}
            </p>
        </div>
        <div class="border rounded p-4 {{ $margin->profit_status === 'untung' ? 'bg-green-50' : 'bg-red-50' }}">
            <p class="text-sm text-gray-500">Margin %</p>
            <p class="text-lg font-semibold {{ $margin->profit_status === 'untung' ? 'text-green-700' : 'text-red-700' }}">
                {{ number_format($margin->margin_percent, 2) }}%
            </p>
        </div>
    </div>

    <div class="mb-6 flex items-center gap-3">
        <span class="text-sm">Status:
            <span class="px-2 py-1 rounded text-xs font-semibold {{ $isFinal ? 'bg-indigo-100 text-indigo-700' : 'bg-yellow-100 text-yellow-700' }}">
                {{ $isFinal ? 'Final' : 'Draft' }}
            </span>
        </span>

        @if ($canEdit)
            @if (! $isFinal)
                <button wire:click="finalisasi" wire:confirm="Yakin finalisasi margin? Setelah final, biaya tidak bisa diubah sampai dibuka kembali." class="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm">
                    Finalisasi Margin
                </button>
            @else
                <button wire:click="bukaKembali" wire:confirm="Buka kembali margin untuk diedit?" class="bg-gray-200 text-gray-800 px-3 py-1.5 rounded text-sm">
                    Buka Kembali
                </button>
            @endif
        @endif
    </div>

    {{-- Tabel Biaya --}}
    <div class="overflow-x-auto">
        <table class="w-full border-collapse mb-6">
            <thead>
                <tr class="bg-gray-100 text-left">
                    <th class="p-2 border">Kategori</th>
                    <th class="p-2 border">Deskripsi</th>
                    <th class="p-2 border">Estimasi</th>
                    <th class="p-2 border">Aktual</th>
                    <th class="p-2 border">Status</th>
                    @if ($canEdit)
                        <th class="p-2 border">Aksi</th>
                    @endif
                </tr>
            </thead>
            <tbody>
                @forelse ($costs as $cost)
                    <tr>
                        <td class="p-2 border">{{ $cost->categoryLabel() }}</td>
                        <td class="p-2 border">{{ $cost->description }}</td>
                        <td class="p-2 border">{{ $cost->estimated_amount !== null ? 'Rp ' . number_format($cost->estimated_amount, 0, ',', '.') : '-' }}</td>
                        <td class="p-2 border">{{ $cost->isActual() ? 'Rp ' . number_format($cost->actual_amount, 0, ',', '.') : '-' }}</td>
                        <td class="p-2 border capitalize">{{ $cost->isActual() ? 'aktual' : 'estimasi' }}</td>
                        @if ($canEdit)
                            <td class="p-2 border">
                                @if (! $isFinal)
                                    <button wire:click="editBiaya({{ $cost->id }})" class="text-indigo-600 underline text-sm mr-2">Edit</button>
                                    <button wire:click="hapusBiaya({{ $cost->id }})" wire:confirm="Hapus baris biaya ini?" class="text-red-600 underline text-sm">Hapus</button>
                                @else
                                    <span class="text-gray-400 text-sm">Terkunci</span>
                                @endif
                            </td>
                        @endif
                    </tr>
                @empty
                    <tr><td colspan="{{ $canEdit ? 6 : 5 }}" class="p-4 text-center text-gray-500">Belum ada baris biaya.</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>

    {{-- Form Tambah/Edit Biaya --}}
    @if ($canEdit && ! $isFinal)
        <div class="mb-4 bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
            <strong>Referensi:</strong> Service Charge invoice ini adalah
            <strong>Rp {{ number_format($invoice->service_charge_amount, 0, ',', '.') }}</strong>
            — gunakan sebagai acuan saat mengisi estimasi kategori <strong>Tenaga Kerja</strong> (pelayan) dan <strong>Sewa Peralatan</strong>.
        </div>

        <h4 class="font-semibold mb-2">{{ $editingId ? 'Edit Biaya' : 'Tambah Biaya' }}</h4>
        <form wire:submit="{{ $editingId ? 'updateBiaya' : 'tambahBiaya' }}" class="grid grid-cols-1 gap-4">
            <div>
                <label class="block text-sm mb-1">Kategori</label>
                <select wire:model="category" class="w-full border rounded px-3 py-2">
                    <option value="hpp_bahan_baku">HPP Bahan Baku</option>
                    <option value="hpp_barang">HPP Barang</option>
                    <option value="tenaga_kerja">Tenaga Kerja</option>
                    <option value="transportasi">Transportasi</option>
                    <option value="delivery">Delivery</option>
                    <option value="vendor">Vendor</option>
                    <option value="sewa_peralatan">Sewa Peralatan</option>
                    <option value="akomodasi">Akomodasi</option>
                    <option value="entertainment">Entertainment</option>
                    <option value="lain_lain">Lain-lain</option>
                </select>
                @error('category') <span class="text-red-600 text-sm">{{ $message }}</span> @enderror
            </div>
            <div>
                <label class="block text-sm mb-1">Deskripsi</label>
                <input type="text" wire:model="description" class="w-full border rounded px-3 py-2">
                @error('description') <span class="text-red-600 text-sm">{{ $message }}</span> @enderror
            </div>
            <div>
                <label class="block text-sm mb-1">Estimasi (Rp)</label>
                <input type="number" step="0.01" wire:model="estimated_amount" class="w-full border rounded px-3 py-2">
                @error('estimated_amount') <span class="text-red-600 text-sm">{{ $message }}</span> @enderror
            </div>
            <div>
                <label class="block text-sm mb-1">Aktual (Rp)</label>
                <input type="number" step="0.01" wire:model="actual_amount" class="w-full border rounded px-3 py-2">
                @error('actual_amount') <span class="text-red-600 text-sm">{{ $message }}</span> @enderror
            </div>
            <div>
                <label class="block text-sm mb-1">Catatan (opsional)</label>
                <input type="text" wire:model="notes" class="w-full border rounded px-3 py-2">
            </div>
            <div class="flex gap-2">
                <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded">{{ $editingId ? 'Simpan Perubahan' : 'Tambah Biaya' }}</button>
                @if ($editingId)
                    <button type="button" wire:click="batalEdit" class="bg-gray-200 text-gray-800 px-4 py-2 rounded">Batal</button>
                @endif
            </div>
        </form>
    @endif
</div>