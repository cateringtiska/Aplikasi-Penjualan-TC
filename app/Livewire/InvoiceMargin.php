<?php

namespace App\Livewire;

use App\Models\Invoice;
use App\Models\InvoiceCost;
use App\Models\InvoiceMargin as InvoiceMarginModel;
use Livewire\Component;

class InvoiceMargin extends Component
{
    public Invoice $invoice;

    public $category = 'hpp_bahan_baku';
    public $description = '';
    public $estimated_amount = '';
    public $actual_amount = '';
    public $notes = '';
    public $editingId = null;

    protected $rules = [
        'category' => 'required|in:hpp_bahan_baku,hpp_barang,tenaga_kerja,transportasi,delivery,vendor,sewa_peralatan,akomodasi,entertainment,lain_lain',
        'description' => 'required|min:3',
        'estimated_amount' => 'nullable|numeric|min:0',
        'actual_amount' => 'nullable|numeric|min:0',
        'notes' => 'nullable',
    ];

    public function mount(Invoice $invoice)
    {
        $this->invoice = $invoice;
    }

    public function tambahBiaya()
    {
        if (! $this->ensureCanEdit()) {
            return;
        }

        $this->validate();

        InvoiceCost::create([
            'invoice_id' => $this->invoice->id,
            'category' => $this->category,
            'description' => $this->description,
            'estimated_amount' => $this->estimated_amount !== '' ? $this->estimated_amount : null,
            'actual_amount' => $this->actual_amount !== '' ? $this->actual_amount : null,
            'status' => ((float) ($this->actual_amount ?: 0) > 0) ? 'aktual' : 'estimasi',
            'notes' => $this->notes,
            'created_by' => auth()->id(),
        ]);

        $this->resetForm();
        $this->recalculateMargin();
        session()->flash('margin_message', 'Baris biaya berhasil ditambahkan.');
    }

    public function editBiaya($id)
    {
        if (! $this->ensureCanEdit()) {
            return;
        }

        $cost = InvoiceCost::findOrFail($id);
        $this->editingId = $id;
        $this->category = $cost->category;
        $this->description = $cost->description;
        $this->estimated_amount = $cost->estimated_amount;
        $this->actual_amount = $cost->actual_amount;
        $this->notes = $cost->notes;
    }

    public function updateBiaya()
    {
        if (! $this->ensureCanEdit()) {
            return;
        }

        $this->validate();

        $cost = InvoiceCost::findOrFail($this->editingId);
        $cost->update([
            'category' => $this->category,
            'description' => $this->description,
            'estimated_amount' => $this->estimated_amount !== '' ? $this->estimated_amount : null,
            'actual_amount' => $this->actual_amount !== '' ? $this->actual_amount : null,
            'status' => ($this->actual_amount !== '' && $this->actual_amount !== null) ? 'aktual' : 'estimasi',
            'notes' => $this->notes,
        ]);

        $this->resetForm();
        $this->recalculateMargin();
        session()->flash('margin_message', 'Baris biaya berhasil diperbarui.');
    }

    public function batalEdit()
    {
        $this->resetForm();
    }

    public function hapusBiaya($id)
    {
        if (! $this->ensureCanEdit()) {
            return;
        }

        InvoiceCost::findOrFail($id)->delete();
        $this->recalculateMargin();
        session()->flash('margin_message', 'Baris biaya berhasil dihapus.');
    }

    public function finalisasi()
    {
        if (! in_array(auth()->user()->role, ['admin', 'finance'])) {
            abort(403, 'Anda tidak memiliki akses untuk finalisasi margin.');
        }

        $this->recalculateMargin();

        InvoiceMarginModel::where('invoice_id', $this->invoice->id)->update([
            'status' => 'final',
            'finalized_at' => now(),
            'finalized_by' => auth()->id(),
        ]);

        session()->flash('margin_message', 'Margin berhasil difinalisasi.');
    }

    public function bukaKembali()
    {
        if (! in_array(auth()->user()->role, ['admin', 'finance'])) {
            abort(403, 'Anda tidak memiliki akses untuk membuka kembali margin.');
        }

        InvoiceMarginModel::where('invoice_id', $this->invoice->id)->update([
            'status' => 'draft',
            'finalized_at' => null,
            'finalized_by' => null,
        ]);

        session()->flash('margin_message', 'Margin dibuka kembali untuk diedit.');
    }

    protected function ensureCanEdit(): bool
    {
        if (! in_array(auth()->user()->role, ['admin', 'finance'])) {
            abort(403, 'Anda tidak memiliki akses untuk mengubah data biaya & margin.');
        }

        $margin = InvoiceMarginModel::where('invoice_id', $this->invoice->id)->first();
        if ($margin && $margin->status === 'final') {
            session()->flash('margin_error', 'Margin sudah difinalisasi. Klik "Buka Kembali" dulu sebelum mengedit biaya.');
            return false;
        }

        return true;
    }

    protected function resetForm(): void
    {
        $this->reset(['editingId', 'description', 'estimated_amount', 'actual_amount', 'notes']);
        $this->category = 'hpp_bahan_baku';
    }

    protected function recalculateMargin(): void
    {
        $costs = InvoiceCost::where('invoice_id', $this->invoice->id)->get();
        $totalCost = $costs->sum(fn ($cost) => $cost->amount());
        $netSales = (float) $this->invoice->subtotal;
        $profit = $netSales - $totalCost;
        $marginPercent = $netSales > 0 ? round(($profit / $netSales) * 100, 2) : 0;

        InvoiceMarginModel::updateOrCreate(
            ['invoice_id' => $this->invoice->id],
            [
                'net_sales' => $netSales,
                'total_cost' => $totalCost,
                'profit' => $profit,
                'margin_percent' => $marginPercent,
                'profit_status' => $profit >= 0 ? 'untung' : 'rugi',
            ]
        );
    }

        public function render()
    {
        $costs = InvoiceCost::where('invoice_id', $this->invoice->id)->orderBy('id')->get();

        $this->recalculateMargin();
        $margin = InvoiceMarginModel::where('invoice_id', $this->invoice->id)->first();

        return view('livewire.invoice-margin', [
            'costs' => $costs,
            'margin' => $margin,
            'isFinal' => $margin && $margin->status === 'final',
            'canEdit' => in_array(auth()->user()->role, ['admin', 'finance']),
        ]);
    }
}