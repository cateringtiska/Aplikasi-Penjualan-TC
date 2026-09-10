<?php

namespace App\Livewire;

use App\Models\Product;
use Livewire\Attributes\Layout;
use Livewire\Component;

#[Layout('layouts.app')]
class ManajemenProduk extends Component
{
    public $search = '';
    public $showForm = false;
    public $editingId = null;

    public $name = '';
    public $type = 'barang';
    public $unit = 'pcs';
    public $default_price = 0;
    public $description = '';

    protected function rules()
    {
        return [
            'name' => 'required|min:3',
            'type' => 'required|in:barang,jasa',
            'unit' => 'required|string|max:20',
            'default_price' => 'required|numeric|min:0',
            'description' => 'nullable|string',
        ];
    }

    public function tambahBaru()
    {
        $this->resetForm();
        $this->showForm = true;
    }

    public function edit($id)
    {
        $product = Product::findOrFail($id);
        $this->editingId = $product->id;
        $this->name = $product->name;
        $this->type = $product->type;
        $this->unit = $product->unit;
        $this->default_price = $product->default_price;
        $this->description = $product->description;
        $this->showForm = true;
    }

    public function simpan()
    {
        $this->validate();

        if ($this->editingId) {
            $product = Product::findOrFail($this->editingId);
            $product->update([
                'name' => $this->name,
                'type' => $this->type,
                'unit' => $this->unit,
                'default_price' => $this->default_price,
                'description' => $this->description,
            ]);
            session()->flash('message', 'Data produk berhasil diperbarui.');
        } else {
            Product::create([
                'product_code' => Product::generateCode(),
                'name' => $this->name,
                'type' => $this->type,
                'unit' => $this->unit,
                'default_price' => $this->default_price,
                'description' => $this->description,
                'status' => 'active',
                'created_by' => auth()->id(),
            ]);
            session()->flash('message', 'Produk baru berhasil ditambahkan.');
        }

        $this->resetForm();
        $this->showForm = false;
    }

    public function batal()
    {
        $this->resetForm();
        $this->showForm = false;
    }

    public function toggleStatus($id)
    {
        $product = Product::findOrFail($id);
        $product->status = $product->status === 'active' ? 'inactive' : 'active';
        $product->save();
    }

    protected function resetForm()
    {
        $this->editingId = null;
        $this->name = '';
        $this->type = 'barang';
        $this->unit = 'pcs';
        $this->default_price = 0;
        $this->description = '';
        $this->resetErrorBag();
    }

    public function render()
    {
        $products = Product::when($this->search, function ($query) {
                $query->where(function ($q) {
                    $q->where('name', 'like', '%' . $this->search . '%')
                      ->orWhere('product_code', 'like', '%' . $this->search . '%');
                });
            })
            ->orderBy('name')
            ->get();

        return view('livewire.manajemen-produk', [
            'products' => $products,
        ]);
    }
}