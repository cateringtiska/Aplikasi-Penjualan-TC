<div class="p-6">
    <h2 class="text-lg font-semibold mb-4">{{ $quotationId ? 'Edit Quotation' : 'Buat Quotation Baru' }}</h2>

    <form wire:submit="simpan">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 bg-gray-50 p-4 rounded border">
            <div>
                <label class="block text-sm mb-1">Customer</label>
                <select wire:model="customer_id" class="w-full border rounded px-3 py-2">
                    <option value="">-- Pilih Customer --</option>
                    @foreach ($customerList as $customer)
                        <option value="{{ $customer->id }}">{{ $customer->name }} ({{ $customer->customer_code }})</option>
                    @endforeach
                </select>
                @error('customer_id') <span class="text-red-600 text-sm">{{ $message }}</span> @enderror
            </div>
            <div>
                <label class="block text-sm mb-1">UP - Kepada (opsional)</label>
                <input type="text" wire:model="contact_person" class="w-full border rounded px-3 py-2">
            </div>
            <div>
                <label class="block text-sm mb-1">Phone - HP (opsional)</label>
                <input type="text" wire:model="contact_phone" class="w-full border rounded px-3 py-2">
            </div>
            <div>
                <label class="block text-sm mb-1">Tanggal Quotation</label>
                <input type="date" wire:model="quotation_date" class="w-full border rounded px-3 py-2">
                @error('quotation_date') <span class="text-red-600 text-sm">{{ $message }}</span> @enderror
            </div>
            <div>
                <label class="block text-sm mb-1">Berlaku Sampai</label>
                <input type="date" wire:model="valid_until" class="w-full border rounded px-3 py-2">
                @error('valid_until') <span class="text-red-600 text-sm">{{ $message }}</span> @enderror
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-gray-50 p-4 rounded border">
            <p class="md:col-span-3 font-medium text-sm text-gray-600">Info Acara (opsional — isi kalau order ini terkait acara/event tertentu)</p>
            <div>
                <label class="block text-sm mb-1">Tanggal Acara</label>
                <input type="date" wire:model="event_date" class="w-full border rounded px-3 py-2">
                @error('event_date') <span class="text-red-600 text-sm">{{ $message }}</span> @enderror
            </div>
            <div>
                <label class="block text-sm mb-1">Jumlah Hari</label>
                <input type="number" wire:model="event_days" class="w-full border rounded px-3 py-2">
            </div>
            <div>
                <label class="block text-sm mb-1">Jenis Acara</label>
                <input type="text" wire:model="event_type" placeholder="misal: Internal, Wedding" class="w-full border rounded px-3 py-2">
            </div>
            <div>
                <label class="block text-sm mb-1">Jam / Waktu</label>
                <input type="text" wire:model="event_time" placeholder="misal: 10.00 WIB - ready to serve" class="w-full border rounded px-3 py-2">
            </div>
            <div>
                <label class="block text-sm mb-1">Jumlah Tamu</label>
                <input type="number" wire:model="guest_count" class="w-full border rounded px-3 py-2">
            </div>
            <div>
                <label class="block text-sm mb-1">F&B Planner</label>
                <input type="text" wire:model="fnb_planner" class="w-full border rounded px-3 py-2">
            </div>
            <div class="md:col-span-3">
                <label class="block text-sm mb-1">Lokasi Acara</label>
                <input type="text" wire:model="venue" class="w-full border rounded px-3 py-2">
            </div>
        </div>

        <div class="mb-6 bg-gray-50 p-4 rounded border">
            <label class="block text-sm mb-1">Catatan (opsional)</label>
            <textarea wire:model="notes" class="w-full border rounded px-3 py-2" rows="2"></textarea>
        </div>

        <div class="mb-6 bg-gray-50 p-4 rounded border">
            <label class="flex items-center gap-2 text-sm font-medium mb-2">
                <input type="checkbox" wire:model.live="show_payment_terms">
                Tampilkan Termin Pembayaran di Detail & PDF
            </label>
            @if ($show_payment_terms)
                <textarea wire:model="payment_terms" class="w-full border rounded px-3 py-2 text-sm" rows="8" placeholder="Tulis termin pembayaran di sini..."></textarea>
            @endif
        </div>

        <h3 class="font-semibold mb-2">Daftar Item</h3>
        <div class="space-y-3 mb-3">
            @foreach ($items as $index => $item)
                <div wire:key="item-{{ $index }}" class="border rounded p-3 bg-white">
                    <div class="grid grid-cols-1 md:grid-cols-6 gap-2 items-end mb-2">
                        <div class="md:col-span-2">
                            <label class="block text-xs mb-1">Pilih Produk (opsional)</label>
                            <select wire:model="items.{{ $index }}.product_id" wire:change="pilihProduk({{ $index }})" class="w-full border rounded px-2 py-1">
                                <option value="">-- Manual --</option>
                                @foreach ($productList as $product)
                                    <option value="{{ $product->id }}">{{ $product->name }}</option>
                                @endforeach
                            </select>
                        </div>
                        <div class="md:col-span-2">
                            <label class="block text-xs mb-1">Nama Item</label>
                            <input type="text" wire:model="items.{{ $index }}.item_name" class="w-full border rounded px-2 py-1">
                            @error("items.$index.item_name") <span class="text-red-600 text-xs">{{ $message }}</span> @enderror
                        </div>
                        <div>
                            <label class="block text-xs mb-1">Satuan</label>
                            <input type="text" wire:model="items.{{ $index }}.unit" class="w-full border rounded px-2 py-1">
                        </div>
                        <div>
                            <label class="block text-xs mb-1">Qty</label>
                            <input type="number" step="0.01" wire:model.live="items.{{ $index }}.qty" class="w-full border rounded px-2 py-1">
                            @error("items.$index.qty") <span class="text-red-600 text-xs">{{ $message }}</span> @enderror
                        </div>
                        <div>
                            <label class="block text-xs mb-1">Harga</label>
                            <input type="number" step="0.01" wire:model.live="items.{{ $index }}.price" class="w-full border rounded px-2 py-1">
                            @error("items.$index.price") <span class="text-red-600 text-xs">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    <div class="flex flex-wrap items-center gap-4 text-sm mb-2">
                        <label class="flex items-center gap-1">
                            <input type="checkbox" wire:model.live="items.{{ $index }}.is_compliment">
                            Compliment (gratis)
                        </label>
                        <label class="flex items-center gap-1">
                            <input type="checkbox" wire:model.live="items.{{ $index }}.charge_service">
                            Kena Service Charge
                        </label>
                        <span class="ml-auto font-medium">
                            Subtotal: {{ ($item['is_compliment'] ?? false) ? 'Compliment' : 'Rp ' . number_format((float) ($item['qty'] ?? 0) * (float) ($item['price'] ?? 0), 0, ',', '.') }}
                        </span>
                        <button type="button" wire:click="hapusBaris({{ $index }})" class="text-red-600">Hapus Item</button>
                    </div>

                    @if (!empty($item['children']))
                        <div class="ml-4 pl-3 border-l-2 border-gray-200 space-y-1 mb-2">
                            @foreach ($item['children'] as $childIndex => $child)
                                <div wire:key="item-{{ $index }}-child-{{ $childIndex }}" class="flex items-center gap-2">
                                    <input type="text" wire:model="items.{{ $index }}.children.{{ $childIndex }}.item_name" placeholder="Keterangan isi paket (misal: Kopi)" class="flex-1 border rounded px-2 py-1 text-sm">
                                    <button type="button" wire:click="hapusSubItem({{ $index }}, {{ $childIndex }})" class="text-red-600 text-sm">Hapus</button>
                                </div>
                            @endforeach
                        </div>
                    @endif

                    <button type="button" wire:click="tambahSubItem({{ $index }})" class="text-indigo-600 text-sm underline">+ Tambah Sub-Item / Breakdown</button>
                </div>
            @endforeach
        </div>

        <button type="button" wire:click="tambahBaris" class="mb-6 bg-gray-200 px-3 py-1 rounded text-sm">+ Tambah Item</button>

        <div class="bg-gray-50 p-4 rounded border mb-6 max-w-sm ml-auto space-y-2">
            @php
                $subtotalAll = collect($items)->sum(fn($i) => ($i['is_compliment'] ?? false) ? 0 : (float) ($i['qty'] ?? 0) * (float) ($i['price'] ?? 0));
                $scBase = collect($items)->filter(fn($i) => ($i['charge_service'] ?? true) && !($i['is_compliment'] ?? false))->sum(fn($i) => (float) ($i['qty'] ?? 0) * (float) ($i['price'] ?? 0));
                $scAmount = $service_charge_percent ? round($scBase * (float) $service_charge_percent / 100) : 0;
                $pb1Amount = $pb1_enabled ? round($subtotalAll * (float) $pb1_percent / 100) : 0;
            @endphp
            <div class="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>Rp {{ number_format($subtotalAll, 0, ',', '.') }}</span>
            </div>
            <div class="flex justify-between items-center text-sm">
                <span>Service Charge (%)</span>
                <input type="number" step="0.01" wire:model.live="service_charge_percent" placeholder="0" class="w-20 border rounded px-2 py-1 text-right">
            </div>
            <div class="flex justify-between items-center text-sm">
                <label class="flex items-center gap-1">
                    <input type="checkbox" wire:model.live="pb1_enabled">
                    Kena PB1 (%)
                </label>
                <input type="number" step="0.01" wire:model.live="pb1_percent" placeholder="0" class="w-20 border rounded px-2 py-1 text-right" @disabled(!$pb1_enabled)>
            </div>
            <div class="flex justify-between text-sm text-gray-600">
                <span>Jumlah Service Charge</span>
                <span>Rp {{ number_format($scAmount, 0, ',', '.') }}</span>
            </div>
            <div class="flex justify-between text-sm text-gray-600">
                <span>Jumlah PB1</span>
                <span>Rp {{ number_format($pb1Amount, 0, ',', '.') }}</span>
            </div>
            <div class="flex justify-between text-lg font-semibold border-t pt-2">
                <span>Grand Total</span>
                <span>Rp {{ number_format($subtotalAll + $scAmount + $pb1Amount, 0, ',', '.') }}</span>
            </div>
        </div>

        <div class="flex gap-2">
            <button type="submit" class="bg-indigo-600 text-white px-6 py-2 rounded">Simpan Quotation</button>
            <a href="{{ route('quotations.index') }}" class="bg-gray-300 px-6 py-2 rounded inline-block">Batal</a>
        </div>
    </form>
</div>