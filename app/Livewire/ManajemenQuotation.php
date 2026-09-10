<?php

namespace App\Livewire;

use App\Models\Quotation;
use Livewire\Attributes\Layout;
use Livewire\Component;

#[Layout('layouts.app')]
class ManajemenQuotation extends Component
{
    public $search = '';
    public $filterStatus = '';

    public function kirim($id)
    {
        Quotation::findOrFail($id)->update(['status' => 'sent']);
        session()->flash('message', 'Quotation ditandai sebagai Terkirim.');
    }

    public function setujui($id)
    {
        Quotation::findOrFail($id)->update(['status' => 'approved']);
        session()->flash('message', 'Quotation ditandai Disetujui.');
    }

    public function tolak($id)
    {
        Quotation::findOrFail($id)->update(['status' => 'rejected']);
        session()->flash('message', 'Quotation ditandai Ditolak.');
    }

    public function hapus($id)
    {
        $quotation = Quotation::findOrFail($id);
        if ($quotation->status === 'draft') {
            $quotation->items()->delete();
            $quotation->delete();
            session()->flash('message', 'Quotation berhasil dihapus.');
        }
    }

    public function render()
    {
        $quotations = Quotation::with('customer')
            ->when($this->search, function ($query) {
                $query->where(function ($q) {
                    $q->where('quotation_number', 'like', '%' . $this->search . '%')
                      ->orWhereHas('customer', function ($q2) {
                          $q2->where('name', 'like', '%' . $this->search . '%');
                      });
                });
            })
            ->when($this->filterStatus, function ($query) {
                $query->where('status', $this->filterStatus);
            })
            ->orderByDesc('id')
            ->get();

        // Otomatis tandai Kadaluarsa kalau sudah lewat tanggal berlaku dan masih Terkirim
        foreach ($quotations as $quotation) {
            if ($quotation->status === 'sent' && $quotation->valid_until->isPast()) {
                $quotation->update(['status' => 'expired']);
            }
        }

        return view('livewire.manajemen-quotation', [
            'quotations' => $quotations,
        ]);
    }
}