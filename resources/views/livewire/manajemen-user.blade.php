<div class="p-6">
    @if (session('message'))
        <div class="mb-4 rounded bg-green-100 p-3 text-green-800">
            {{ session('message') }}
        </div>
    @endif

    <h2 class="text-lg font-semibold mb-4">Tambah User Baru</h2>
    <form wire:submit="simpan" class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div>
            <label class="block text-sm mb-1">Nama</label>
            <input type="text" wire:model="name" class="w-full border rounded px-3 py-2">
            @error('name') <span class="text-red-600 text-sm">{{ $message }}</span> @enderror
        </div>
        <div>
            <label class="block text-sm mb-1">Email</label>
            <input type="email" wire:model="email" class="w-full border rounded px-3 py-2">
            @error('email') <span class="text-red-600 text-sm">{{ $message }}</span> @enderror
        </div>
        <div>
            <label class="block text-sm mb-1">Password</label>
            <input type="password" wire:model="password" class="w-full border rounded px-3 py-2">
            @error('password') <span class="text-red-600 text-sm">{{ $message }}</span> @enderror
        </div>
        <div>
            <label class="block text-sm mb-1">Role</label>
            <select wire:model="role" class="w-full border rounded px-3 py-2">
                <option value="admin">Admin</option>
                <option value="sales">Sales</option>
                <option value="finance">Finance</option>
            </select>
        </div>
        <div class="md:col-span-2">
            <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded">Simpan User</button>
        </div>
    </form>

    <h2 class="text-lg font-semibold mb-4">Daftar User</h2>
    <table class="w-full border-collapse">
        <thead>
            <tr class="bg-gray-100 text-left">
                <th class="p-2 border">Nama</th>
                <th class="p-2 border">Email</th>
                <th class="p-2 border">Role</th>
                <th class="p-2 border">Status</th>
                <th class="p-2 border">Aksi</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($users as $user)
                <tr>
                    <td class="p-2 border">{{ $user->name }}</td>
                    <td class="p-2 border">{{ $user->email }}</td>
                    <td class="p-2 border capitalize">{{ $user->role }}</td>
                    <td class="p-2 border">{{ $user->is_active ? 'Aktif' : 'Nonaktif' }}</td>
                    <td class="p-2 border">
                        <button wire:click="ubahStatus({{ $user->id }})" class="text-indigo-600 underline">
                            {{ $user->is_active ? 'Nonaktifkan' : 'Aktifkan' }}
                        </button>
                    </td>
                </tr>
            @endforeach
        </tbody>
    </table>
</div>