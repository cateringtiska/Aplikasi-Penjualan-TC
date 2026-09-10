<?php

namespace App\Livewire;

use App\Models\Invoice;
use Livewire\Attributes\Layout;
use Livewire\Component;
use Livewire\WithPagination;

#[Layout('layouts.app')]
class ManajemenInvoice extends Component
{
    use WithPagination;

    public string $search = '';
    public string $filterStatus = '';

    public function updatingSearch(): void
    {
        $this->resetPage();
    }

    public function updatingFilterStatus(): void
    {
        $this->resetPage();
    }

        

    public function batalkan($id): void
    {
        $invoice = Invoice::findOrFail($id);
        $invoice->update(['status' => 'cancelled']);

        session()->flash('message', 'Invoice ' . $invoice->invoice_number . ' dibatalkan.');
    }

    public function hapus($id): void
    {
        $invoice = Invoice::findOrFail($id);
        $invoice->items()->delete();
        $invoice->delete();

        session()->flash('message', 'Invoice berhasil dihapus.');
    }

    public function render()
    {
        // Auto-update status overdue jika sudah lewat jatuh tempo
        Invoice::where('due_date', '<', now())
            ->whereIn('status', ['unpaid', 'partial'])
            ->update(['status' => 'overdue']);

        $invoices = Invoice::with('customer')
            ->when($this->search, function ($query) {
                $query->where('invoice_number', 'like', '%' . $this->search . '%')
                    ->orWhereHas('customer', function ($q) {
                        $q->where('name', 'like', '%' . $this->search . '%');
                    });
            })
            ->when($this->filterStatus, function ($query) {
                $query->where('status', $this->filterStatus);
            })
            ->orderByDesc('id')
            ->paginate(10);

        return view('livewire.manajemen-invoice', [
            'invoices' => $invoices,
        ]);
    }
}