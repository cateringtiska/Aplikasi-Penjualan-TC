<?php

namespace App\Livewire;

use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Product;
use App\Models\Quotation;
use App\Models\CompanySetting;
use Livewire\Attributes\Layout;
use Livewire\Component;

#[Layout('layouts.app')]
class FormInvoice extends Component
{
    public $invoiceId = null;
    public $quotationId = null;
    public $quotationNumber = null;
    public $customer_id = '';
    public $contact_person = '';
    public $contact_phone = '';
    public $invoice_date;
    public $due_date;
    public $event_date = '';
    public $event_days = '';
    public $event_type = '';
    public $event_time = '';
    public $guest_count = '';
    public $fnb_planner = '';
    public $venue = '';
    public $notes = '';
    public $service_charge_percent = '';    
    public $items = [];
    public $show_payment_terms = false;
    public $payment_terms = '';
    public $pb1_enabled = false;
    public $pb1_percent = 10;

    public function mount($id = null)
    {
        $this->invoice_date = now()->format('Y-m-d');
        $this->due_date = now()->format('Y-m-d');

        if ($id) {
            $invoice = Invoice::with(['items' => function ($q) {
                $q->whereNull('parent_id')->with('children');
            }])->findOrFail($id);

            $this->invoiceId = $invoice->id;
            $this->quotationId = $invoice->quotation_id;
            $this->customer_id = $invoice->customer_id;
            $this->contact_person = $invoice->contact_person;
            $this->contact_phone = $invoice->contact_phone;
            $this->invoice_date = $invoice->invoice_date->format('Y-m-d');
            $this->due_date = $invoice->due_date->format('Y-m-d');
            $this->event_date = $invoice->event_date?->format('Y-m-d') ?? '';
            $this->event_days = $invoice->event_days;
            $this->event_type = $invoice->event_type;
            $this->event_time = $invoice->event_time;
            $this->guest_count = $invoice->guest_count;
            $this->fnb_planner = $invoice->fnb_planner;
            $this->venue = $invoice->venue;
            $this->notes = $invoice->notes;
            $this->show_payment_terms = (bool) $invoice->show_payment_terms;
            $this->pb1_enabled = (bool) $invoice->pb1_enabled;
            $this->pb1_percent = $invoice->pb1_percent;
            $this->payment_terms = $invoice->payment_terms ?? '';   
            $this->service_charge_percent = $invoice->service_charge_percent;
            $this->items = $invoice->items->map(function ($item) {
                return [
                    'product_id' => $item->product_id,
                    'item_name' => $item->item_name,
                    'unit' => $item->unit,
                    'qty' => $item->qty,
                    'price' => $item->price,
                    'is_compliment' => (bool) $item->is_compliment,
                    'charge_service' => (bool) $item->charge_service,
                    'children' => $item->children->map(fn ($c) => ['item_name' => $c->item_name])->toArray(),
                ];
            })->toArray();
        } elseif (request()->query('from_quotation')) {
            $quotation = Quotation::with(['items' => function ($q) {
                $q->whereNull('parent_id')->with('children');
            }])->findOrFail(request()->query('from_quotation'));

            $this->quotationId = $quotation->id;
            $this->quotationNumber = $quotation->quotation_number;
            $this->customer_id = $quotation->customer_id;
            $this->contact_person = $quotation->contact_person;
            $this->contact_phone = $quotation->contact_phone;
            $this->event_date = $quotation->event_date?->format('Y-m-d') ?? '';
            $this->event_days = $quotation->event_days;
            $this->event_type = $quotation->event_type;
            $this->event_time = $quotation->event_time;
            $this->guest_count = $quotation->guest_count;
            $this->fnb_planner = $quotation->fnb_planner;
            $this->venue = $quotation->venue;
            $this->service_charge_percent = $quotation->service_charge_percent;
            $this->pb1_enabled = (bool) $quotation->pb1_enabled;
            $this->pb1_percent = $quotation->pb1_percent;
            $this->show_payment_terms = (bool) $quotation->show_payment_terms;
            $this->payment_terms = CompanySetting::current()->payment_terms_default ?? '';
            $this->notes = 'Dikonversi dari Quotation ' . $quotation->quotation_number;
            $this->items = $quotation->items->map(function ($item) {
                return [
                    'product_id' => $item->product_id,
                    'item_name' => $item->item_name,
                    'unit' => $item->unit,
                    'qty' => $item->qty,
                    'price' => $item->price,
                    'is_compliment' => (bool) $item->is_compliment,
                    'charge_service' => (bool) $item->charge_service,
                    'children' => $item->children->map(fn ($c) => ['item_name' => $c->item_name])->toArray(),
                ];
            })->toArray();
        } else {
            $this->tambahBaris();
            $this->payment_terms = CompanySetting::current()->payment_terms_default ?? '';
        }
        }

    public function tambahBaris()
    {
        $this->items[] = [
            'product_id' => '',
            'item_name' => '',
            'unit' => '',
            'qty' => 1,
            'price' => 0,
            'is_compliment' => false,
            'charge_service' => true,
            'children' => [],
        ];
    }

    public function hapusBaris($index)
    {
        unset($this->items[$index]);
        $this->items = array_values($this->items);

        if (empty($this->items)) {
            $this->tambahBaris();
        }
    }

    public function tambahSubItem($index)
    {
        $this->items[$index]['children'][] = ['item_name' => ''];
    }

    public function hapusSubItem($index, $childIndex)
    {
        unset($this->items[$index]['children'][$childIndex]);
        $this->items[$index]['children'] = array_values($this->items[$index]['children']);
    }

    public function pilihProduk($index)
    {
        $productId = $this->items[$index]['product_id'] ?? null;

        if ($productId) {
            $product = Product::find($productId);
            if ($product) {
                $this->items[$index]['item_name'] = $product->name;
                $this->items[$index]['unit'] = $product->unit;
                $this->items[$index]['price'] = $product->default_price;
            }
        }
    }

    protected function serviceChargeBase(): float
    {
        return collect($this->items)
            ->filter(fn ($item) => ($item['charge_service'] ?? true) && !($item['is_compliment'] ?? false))
            ->sum(fn ($item) => ($item['qty'] ?? 0) * ($item['price'] ?? 0));
    }

    public function simpan()
    {
        $this->validate([
            'customer_id' => 'required|exists:customers,id',
            'invoice_date' => 'required|date',
            'due_date' => 'required|date|after_or_equal:invoice_date',
            'event_date' => 'nullable|date',
            'service_charge_percent' => 'nullable|numeric|min:0|max:100',
            'items' => 'required|array|min:1',
            'items.*.item_name' => 'required|string',
            'items.*.qty' => 'required|numeric|min:0.01',
            'items.*.price' => 'required|numeric|min:0',
        ]);

        $subtotal = collect($this->items)->sum(fn ($item) => ($item['is_compliment'] ?? false) ? 0 : $item['qty'] * $item['price']);
        $base = $this->serviceChargeBase();
        $serviceChargeAmount = $this->service_charge_percent
        ? round($base * (float) $this->service_charge_percent / 100)
        : 0;
        $pb1Amount = $this->pb1_enabled
        ? round($subtotal * (float) $this->pb1_percent / 100)
        : 0;
        $grandTotal = $subtotal + $serviceChargeAmount + $pb1Amount;
        $data = [
            'customer_id' => $this->customer_id,
            'contact_person' => $this->contact_person ?: null,
            'contact_phone' => $this->contact_phone ?: null,
            'invoice_date' => $this->invoice_date,
            'due_date' => $this->due_date,
            'event_date' => $this->event_date ?: null,
            'event_days' => $this->event_days ?: null,
            'event_type' => $this->event_type ?: null,
            'event_time' => $this->event_time ?: null,
            'guest_count' => $this->guest_count ?: null,
            'fnb_planner' => $this->fnb_planner ?: null,
            'venue' => $this->venue ?: null,
            'notes' => $this->notes,
            'subtotal' => $subtotal,
            'service_charge_percent' => $this->service_charge_percent ?: null,
            'service_charge_amount' => $serviceChargeAmount,
            'pb1_enabled' => $this->pb1_enabled,
            'pb1_percent' => $this->pb1_percent,
            'pb1_amount' => $pb1Amount,
            'grand_total' => $grandTotal,
            'show_payment_terms' => $this->show_payment_terms,
            'payment_terms' => $this->show_payment_terms ? $this->payment_terms : null,
        ];

        if ($this->invoiceId) {
            $invoice = Invoice::findOrFail($this->invoiceId);
            $invoice->update($data);
            $invoice->items()->delete();
        } else {
            $invoice = Invoice::create($data + [
                'invoice_number' => Invoice::generateNumber(),
                'quotation_id' => $this->quotationId,
                'status' => 'unpaid',
                'paid_amount' => 0,
                'created_by' => auth()->id(),
            ]);
        }

        foreach ($this->items as $item) {
            $parent = $invoice->items()->create([
                'product_id' => $item['product_id'] ?: null,
                'item_name' => $item['item_name'],
                'unit' => $item['unit'],
                'qty' => $item['qty'],
                'price' => $item['price'],
                'subtotal' => ($item['is_compliment'] ?? false) ? 0 : $item['qty'] * $item['price'],
                'is_compliment' => $item['is_compliment'] ?? false,
                'charge_service' => $item['charge_service'] ?? true,
            ]);

            foreach (($item['children'] ?? []) as $child) {
                if (trim($child['item_name'] ?? '') === '') {
                    continue;
                }
                $invoice->items()->create([
                    'parent_id' => $parent->id,
                    'item_name' => $child['item_name'],
                    'unit' => null,
                    'qty' => 0,
                    'price' => 0,
                    'subtotal' => 0,
                    'is_compliment' => false,
                    'charge_service' => false,
                ]);
            }
        }

        session()->flash('message', $this->invoiceId ? 'Invoice berhasil diperbarui.' : 'Invoice baru berhasil dibuat.');

        return redirect()->route('invoices.index');
    }

    public function render()
    {
        return view('livewire.form-invoice', [
            'customerList' => Customer::where('status', 'active')->orderBy('name')->get(),
            'productList' => Product::where('status', 'active')->orderBy('name')->get(),
        ]);
    }
}