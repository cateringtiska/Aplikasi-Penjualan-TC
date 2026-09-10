<?php

namespace App\Livewire;

use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentDetail;
use Livewire\Attributes\Layout;
use Livewire\Component;

#[Layout('layouts.app')]
class FormPembayaran extends Component
{
    public $customer_id = '';
    public $payment_date;
    public $payment_method = 'transfer';
    public $bank_cash = '';
    public $notes = '';
    public $total_amount = 0;
    public $outstandingInvoices = [];

    public function mount()
    {
        $this->payment_date = now()->format('Y-m-d');

        if (request()->query('invoice_id')) {
            $invoice = Invoice::findOrFail(request()->query('invoice_id'));
            $this->customer_id = $invoice->customer_id;
            $this->loadOutstandingInvoices();

            foreach ($this->outstandingInvoices as $index => $row) {
                if ($row['invoice_id'] == $invoice->id) {
                    $this->outstandingInvoices[$index]['checked'] = true;
                    $this->outstandingInvoices[$index]['amount'] = $row['sisa'];
                    $this->total_amount = $row['sisa'];
                }
            }
        }
    }

    public function updatedCustomerId()
    {
        $this->loadOutstandingInvoices();
    }

    public function loadOutstandingInvoices()
    {
        if (! $this->customer_id) {
            $this->outstandingInvoices = [];
            return;
        }

        $invoices = Invoice::where('customer_id', $this->customer_id)
            ->whereIn('status', ['unpaid', 'partial', 'overdue'])
            ->orderBy('due_date')
            ->get();

        $this->outstandingInvoices = $invoices->map(function ($invoice) {
            return [
                'invoice_id' => $invoice->id,
                'invoice_number' => $invoice->invoice_number,
                'due_date' => $invoice->due_date->format('d/m/Y'),
                'sisa' => $invoice->remainingAmount(),
                'checked' => false,
                'amount' => 0,
            ];
        })->toArray();
    }

    public function simpan()
    {
        $this->validate([
            'customer_id' => 'required|exists:customers,id',
            'payment_date' => 'required|date',
            'payment_method' => 'required|in:cash,transfer,giro,lainnya',
            'total_amount' => 'required|numeric|min:1',
        ]);

        $selected = collect($this->outstandingInvoices)
            ->filter(fn ($row) => $row['checked'] && (float) ($row['amount'] ?? 0) > 0);

        if ($selected->isEmpty()) {
            $this->addError('total_amount', 'Pilih minimal satu invoice dan isi jumlah alokasinya.');
            return;
        }

        foreach ($selected as $row) {
            if ((float) $row['amount'] > (float) $row['sisa']) {
                $this->addError('total_amount', "Jumlah bayar untuk {$row['invoice_number']} melebihi sisa tagihan invoice tersebut.");
                return;
            }
        }

        $totalAllocated = $selected->sum(fn ($row) => (float) $row['amount']);

        if (round($totalAllocated, 2) !== round((float) $this->total_amount, 2)) {
            $this->addError('total_amount', 'Total jumlah alokasi ke invoice (Rp ' . number_format($totalAllocated, 0, ',', '.') . ') harus sama dengan Total Pembayaran Diterima.');
            return;
        }

        $payment = Payment::create([
            'payment_number' => Payment::generateNumber(),
            'payment_date' => $this->payment_date,
            'customer_id' => $this->customer_id,
            'payment_method' => $this->payment_method,
            'bank_cash' => $this->bank_cash,
            'total_amount' => $this->total_amount,
            'notes' => $this->notes,
            'created_by' => auth()->id(),
        ]);

        foreach ($selected as $row) {
            PaymentDetail::create([
                'payment_id' => $payment->id,
                'invoice_id' => $row['invoice_id'],
                'amount_applied' => $row['amount'],
            ]);

            Invoice::find($row['invoice_id'])->recalculateStatus();
        }

        session()->flash('message', 'Pembayaran ' . $payment->payment_number . ' berhasil disimpan.');

        return redirect()->route('payments.index');
    }

    public function render()
    {
        return view('livewire.form-pembayaran', [
            'customerList' => Customer::where('status', 'active')->orderBy('name')->get(),
        ]);
    }
}