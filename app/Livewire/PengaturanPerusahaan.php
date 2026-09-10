<?php

namespace App\Livewire;

use App\Models\CompanySetting;
use Livewire\Attributes\Layout;
use Livewire\Component;
use Livewire\WithFileUploads;

#[Layout('layouts.app')]
class PengaturanPerusahaan extends Component
{
    use WithFileUploads;

    public $company_name = '';
    public $bank_name = '';
    public $bank_account_number = '';
    public $bank_account_holder = '';
    public $logo; // file upload sementara
    public $signature; // file upload sementara
    public $currentSignaturePath = null;
    public $currentLogoPath = null;
    public $payment_terms_default = '';
    public $quotation_terms_default = '';

    public function mount()
    {
        $settings = CompanySetting::current();
        $this->company_name = $settings->company_name;
        $this->bank_name = $settings->bank_name;
        $this->bank_account_number = $settings->bank_account_number;
        $this->bank_account_holder = $settings->bank_account_holder;
        $this->currentLogoPath = $settings->logo_path;
        $this->currentSignaturePath = $settings->signature_path;
        $this->payment_terms_default = $settings->payment_terms_default;
        $this->quotation_terms_default = $settings->quotation_terms_default;
    }

    public function simpan()
    {
        $this->validate([
            'company_name' => 'required|string|max:255',
            'bank_name' => 'nullable|string|max:255',
            'bank_account_number' => 'nullable|string|max:100',
            'bank_account_holder' => 'nullable|string|max:255',
            'logo' => 'nullable|image|max:2048',
            'signature' => 'nullable|image|max:2048',
            'payment_terms_default' => 'nullable|string',
            'quotation_terms_default' => 'nullable|string',
        ]);

        $settings = CompanySetting::current();

        $data = [
            'company_name' => $this->company_name,
            'bank_name' => $this->bank_name,
            'bank_account_number' => $this->bank_account_number,
            'bank_account_holder' => $this->bank_account_holder,
            'payment_terms_default' => $this->payment_terms_default,
            'quotation_terms_default' => $this->quotation_terms_default,
        ];

        if ($this->logo) {
            $data['logo_path'] = $this->logo->store('logos', 'public');
        }

        if ($this->signature) {
            $data['signature_path'] = $this->signature->store('signatures', 'public');
        }

        $settings->update($data);
        $this->currentLogoPath = $settings->logo_path;
        $this->logo = null;
        $this->currentSignaturePath = $settings->signature_path;
        $this->signature = null;

        session()->flash('message', 'Pengaturan perusahaan berhasil disimpan.');
    }

    public function render()
    {
        return view('livewire.pengaturan-perusahaan');
    }
}