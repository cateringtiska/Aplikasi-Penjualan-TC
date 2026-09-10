<?php

namespace App\Livewire;

use App\Models\Invoice;
use Livewire\Attributes\Layout;
use Livewire\Component;

#[Layout('layouts.app')]
class KartuPiutang extends Component
{
    public $search = '';

    public function render()
    {
        $today = now()->startOfDay();

        $invoices = Invoice::with('customer')
            ->whereIn('status', ['unpaid', 'partial', 'overdue'])
            ->get();

        if ($this->search) {
            $keyword = strtolower($this->search);
            $invoices = $invoices->filter(fn ($invoice) => str_contains(strtolower($invoice->customer->name), $keyword));
        }

        $piutangPerCustomer = $invoices->groupBy('customer_id')
            ->map(function ($group) use ($today) {
                $customer = $group->first()->customer;
                $tertua = $group->min('due_date');
                $hariTerlambat = $tertua->lt($today) ? (int) abs($today->diffInDays($tertua)) : 0;

                return [
                    'customer' => $customer,
                    'jumlah_invoice' => $group->count(),
                    'total_piutang' => $group->sum(fn ($invoice) => $invoice->remainingAmount()),
                    'jatuh_tempo_tertua' => $tertua,
                    'hari_terlambat' => $hariTerlambat,
                ];
            })
            ->sortByDesc('total_piutang')
            ->values();

        $agingBelumJatuhTempo = 0;
        $aging1_30 = 0;
        $aging31_60 = 0;
        $aging60plus = 0;

        foreach ($invoices as $invoice) {
            $sisa = $invoice->remainingAmount();

            if ($invoice->due_date->greaterThanOrEqualTo($today)) {
                $agingBelumJatuhTempo += $sisa;
            } else {
                $hari = (int) abs($today->diffInDays($invoice->due_date));

                if ($hari <= 30) {
                    $aging1_30 += $sisa;
                } elseif ($hari <= 60) {
                    $aging31_60 += $sisa;
                } else {
                    $aging60plus += $sisa;
                }
            }
        }

        return view('livewire.kartu-piutang', [
            'piutangPerCustomer' => $piutangPerCustomer,
            'totalPiutangKeseluruhan' => $piutangPerCustomer->sum('total_piutang'),
            'agingBelumJatuhTempo' => $agingBelumJatuhTempo,
            'aging1_30' => $aging1_30,
            'aging31_60' => $aging31_60,
            'aging60plus' => $aging60plus,
        ]);
    }
}