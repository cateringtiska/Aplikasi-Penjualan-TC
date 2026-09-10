<div class="p-6">
    @if (session('message'))
        <div class="mb-4 rounded bg-green-100 p-3 text-green-800">
            {{ session('message') }}
        </div>
    @endif

    <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-semibold">Master Customer</h2>
        <button wire:click="tambahBaru" class="bg-indigo-600 text-white px-4 py-2 rounded">+ Tambah Customer</button>
    </div>

    <div class="mb-4">
        <input type="text" wire:model.live="search" placeholder="Cari nama, kode, atau telepon..." class="w-full border rounded px-3 py-2">
    </div>

    @if ($showForm)
        <form wire:submit="simpan" class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 bg-gray-50 p-4 rounded border">
            <div>
                <label class="block text-sm mb-1">Nama Customer</label>
                <input type="text" wire:model="name" class="w-full border rounded px-3 py-2">
                @error('name') <span class="text-red-600 text-sm">{{ $message }}</span> @enderror
            </div>
            <div>
                <label class="block text-sm mb-1">PIC / Contact Person</label>
                <input type="text" wire:model="pic_name" class="w-full border rounded px-3 py-2">
            </div>
            <div>
                <label class="block text-sm mb-1">Nomor Telepon</label>
                <input type="text" wire:model="phone" class="w-full border rounded px-3 py-2">
                @error('phone') <span class="text-red-600 text-sm">{{ $message }}</span> @enderror
            </div>
            <div>
                <label class="block text-sm mb-1">Email</label>
                <input type="email" wire:model="email" class="w-full border rounded px-3 py-2">
                @error('email') <span class="text-red-600 text-sm">{{ $message }}</span> @enderror
            </div>
            <div>
                <label class="block text-sm mb-1">NPWP</label>
                <input type="text" wire:model="npwp" class="w-full border rounded px-3 py-2">
            </div>
            <div class="md:col-span-2">
                <label class="block text-sm mb-1">Alamat</label>
                <textarea wire:model="address" class="w-full border rounded px-3 py-2" rows="2"></textarea>
            </div>
            <div class="md:col-span-2 flex gap-2">
                <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded">
                    {{ $editingId ? 'Update Customer' : 'Simpan Customer' }}
                </button>
                <button type="button" wire:click="batal" class="bg-gray-300 px-4 py-2 rounded">Batal</button>
            </div>
        </form>
    @endif

    <table class="w-full border-collapse">
        <thead>
            <tr class="bg-gray-100 text-left">
                <th class="p-2 border">Kode</th>
                <th class="p-2 border">Nama</th>
                <th class="p-2 border">Telepon</th>
                <th class="p-2 border">Email</th>
                <th class="p-2 border">Status</th>
                <th class="p-2 border">Aksi</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($customers as $customer)
                <tr>
                    <td class="p-2 border">{{ $customer->customer_code }}</td>
                    <td class="p-2 border">{{ $customer->name }}</td>
                    <td class="p-2 border">{{ $customer->phone }}</td>
                    <td class="p-2 border">{{ $customer->email }}</td>
                    <td class="p-2 border">
                        <span class="{{ $customer->status === 'active' ? 'text-green-700' : 'text-gray-500' }}">
                            {{ $customer->status === 'active' ? 'Aktif' : 'Nonaktif' }}
                        </span>
                    </td>
                    <td class="p-2 border space-x-2">
                        <button wire:click="edit({{ $customer->id }})" class="text-indigo-600 underline">Edit</button>
                        <button wire:click="toggleStatus({{ $customer->id }})" class="text-indigo-600 underline">
                            {{ $customer->status === 'active' ? 'Nonaktifkan' : 'Aktifkan' }}
                        </button>
                        <a href="{{ route('customers.histori', $customer->id) }}" class="text-indigo-600 underline">Histori</a>
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="6" class="p-4 text-center text-gray-500">Belum ada data customer.</td>
                </tr>
            @endforelse
        </tbody>
    </table>
</div>