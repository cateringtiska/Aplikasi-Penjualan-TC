<?php

namespace App\Livewire;

use App\Models\Customer;
use Livewire\Attributes\Layout;
use Livewire\Component;

#[Layout('layouts.app')]
class ManajemenCustomer extends Component
{
    public $search = '';
    public $showForm = false;
    public $editingId = null;

    public $name = '';
    public $address = '';
    public $phone = '';
    public $email = '';
    public $npwp = '';
    public $pic_name = '';

    protected function rules()
    {
        return [
            'name' => 'required|min:3',
            'address' => 'nullable|string',
            'phone' => 'nullable|string|max:20',
            'email' => 'nullable|email',
            'npwp' => 'nullable|string|max:30',
            'pic_name' => 'nullable|string|max:100',
        ];
    }

    public function tambahBaru()
    {
        $this->resetForm();
        $this->showForm = true;
    }

    public function edit($id)
    {
        $customer = Customer::findOrFail($id);
        $this->editingId = $customer->id;
        $this->name = $customer->name;
        $this->address = $customer->address;
        $this->phone = $customer->phone;
        $this->email = $customer->email;
        $this->npwp = $customer->npwp;
        $this->pic_name = $customer->pic_name;
        $this->showForm = true;
    }

    public function simpan()
    {
        $this->validate();

        if ($this->editingId) {
            $customer = Customer::findOrFail($this->editingId);
            $customer->update([
                'name' => $this->name,
                'address' => $this->address,
                'phone' => $this->phone,
                'email' => $this->email,
                'npwp' => $this->npwp,
                'pic_name' => $this->pic_name,
            ]);
            session()->flash('message', 'Data customer berhasil diperbarui.');
        } else {
            Customer::create([
                'customer_code' => Customer::generateCode(),
                'name' => $this->name,
                'address' => $this->address,
                'phone' => $this->phone,
                'email' => $this->email,
                'npwp' => $this->npwp,
                'pic_name' => $this->pic_name,
                'status' => 'active',
                'created_by' => auth()->id(),
            ]);
            session()->flash('message', 'Customer baru berhasil ditambahkan.');
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
        $customer = Customer::findOrFail($id);
        $customer->status = $customer->status === 'active' ? 'inactive' : 'active';
        $customer->save();
    }

    protected function resetForm()
    {
        $this->editingId = null;
        $this->name = '';
        $this->address = '';
        $this->phone = '';
        $this->email = '';
        $this->npwp = '';
        $this->pic_name = '';
        $this->resetErrorBag();
    }

    public function render()
    {
        $customers = Customer::when($this->search, function ($query) {
                $query->where(function ($q) {
                    $q->where('name', 'like', '%' . $this->search . '%')
                      ->orWhere('customer_code', 'like', '%' . $this->search . '%')
                      ->orWhere('phone', 'like', '%' . $this->search . '%');
                });
            })
            ->orderBy('name')
            ->get();

        return view('livewire.manajemen-customer', [
            'customers' => $customers,
        ]);
    }
}