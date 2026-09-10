<div class="p-6 max-w-2xl">
    @if (session('message'))
        <div class="mb-4 rounded bg-green-100 p-3 text-green-800">
            {{ session('message') }}
        </div>
    @endif

    <h2 class="text-lg font-semibold mb-4">Pengaturan Perusahaan</h2>
    <p class="text-sm text-gray-500 mb-6">Data ini dipakai sebagai kop surat dan info rekening pembayaran di semua Invoice & Quotation.</p>

    <form wire:submit="simpan" class="space-y-4 bg-gray-50 p-4 rounded border">
        <div>
            <label class="block text-sm mb-1">Nama Perusahaan</label>
            <input type="text" wire:model="company_name" class="w-full border rounded px-3 py-2">
            @error('company_name') <span class="text-red-600 text-sm">{{ $message }}</span> @enderror
        </div>

        <div>
            <label class="block text-sm mb-1">Logo Perusahaan</label>
            @if ($currentLogoPath)
                <img src="{{ Storage::url($currentLogoPath) }}" class="h-16 mb-2 border rounded p-1 bg-white">
            @endif
            <input type="file" wire:model="logo" class="w-full border rounded px-3 py-2">
            @error('logo') <span class="text-red-600 text-sm">{{ $message }}</span> @enderror
            <p class="text-xs text-gray-500 mt-1">Format gambar (PNG/JPG), maksimal 2 MB.</p>
        </div>
        
         <div>
            <label class="block text-sm mb-1">Tanda Tangan (untuk PDF Quotation & Invoice)</label>
            @if ($currentSignaturePath)
                <img src="{{ Storage::url($currentSignaturePath) }}" class="h-16 mb-2 border rounded p-1 bg-white">
            @endif
            <input type="file" wire:model="signature" class="w-full border rounded px-3 py-2">
            @error('signature') <span class="text-red-600 text-sm">{{ $message }}</span> @enderror
            <p class="text-xs text-gray-500 mt-1">Format gambar (PNG/JPG), maksimal 2 MB. Disarankan PNG background transparan.</p>
        </div>

        <hr>
        <p class="font-medium text-sm">Info Rekening Pembayaran (tampil di footer Invoice)</p>

        <div>
            <label class="block text-sm mb-1">Nama Bank</label>
            <input type="text" wire:model="bank_name" placeholder="Contoh: BCA (Bank Central Asia)" class="w-full border rounded px-3 py-2">
        </div>
        <div>
            <label class="block text-sm mb-1">Nomor Rekening</label>
            <input type="text" wire:model="bank_account_number" class="w-full border rounded px-3 py-2">
        </div>
        <div>
            <label class="block text-sm mb-1">Atas Nama</label>
            <input type="text" wire:model="bank_account_holder" class="w-full border rounded px-3 py-2">
        </div>

        <hr>
        <p class="font-medium text-sm">Termin Pembayaran Default (Invoice)</p>
        <div>
            <label class="block text-sm mb-1">Teks default yang muncul di form Invoice baru (masih bisa diedit per-invoice)</label>
            <textarea wire:model="payment_terms_default" class="w-full border rounded px-3 py-2 text-sm" rows="8"></textarea>
        </div>

        <hr>
        <p class="font-medium text-sm">Syarat & Ketentuan Default (Quotation)</p>
        <div>
            <label class="block text-sm mb-1">Teks default yang muncul di form Quotation baru (masih bisa diedit per-quotation)</label>
            <textarea wire:model="quotation_terms_default" class="w-full border rounded px-3 py-2 text-sm" rows="8"></textarea>
        </div>

        <button type="submit" class="bg-indigo-600 text-white px-6 py-2 rounded">Simpan Pengaturan</button>
    </form>
</div>