<?php

namespace App\Livewire;

use App\Models\Payment;
use Livewire\Attributes\Layout;
use Livewire\Component;

#[Layout('layouts.app')]
class ManajemenPembayaran extends Component
{
    public $search = '';

    public function hapus($id)
    {
        $payment = Payment::with('details.invoice')->findOrFail($id);

        foreach ($payment->details as $detail) {
            $invoice = $detail->invoice;
            $detail->delete();
            if ($invoice) {
                $invoice->recalculateStatus();
            }
        }

        $payment->delete();
        session()->flash('message', 'Pembayaran berhasil dihapus, status invoice terkait sudah diperbarui otomatis.');
    }

    public function render()
    {
        $payments = Payment::with('customer')
            ->when($this->search, function ($query) {
                $query->where('payment_number', 'like', '%' . $this->search . '%')
                    ->orWhereHas('customer', function ($q) {
                        $q->where('name', 'like', '%' . $this->search . '%');
                    });
            })
            ->orderByDesc('id')
            ->get();

        return view('livewire.manajemen-pembayaran', [
            'payments' => $payments,
        ]);
    }
}