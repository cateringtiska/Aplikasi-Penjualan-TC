<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: sans-serif; font-size: 11px; color: #333; }
        h1 { font-size: 16px; margin-bottom: 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 1px solid #999; padding: 5px; text-align: left; }
        th { background-color: #f0f0f0; }
        .text-right { text-align: right; }
        .total-row td { font-weight: bold; background-color: #f9f9f9; }
    </style>
</head>
<body>
    <h1>Laporan Penjualan</h1>
    <p>
        Periode:
        {{ $tanggalDari ? \Carbon\Carbon::parse($tanggalDari)->format('d/m/Y') : 'Semua' }}
        s.d.
        {{ $tanggalSampai ? \Carbon\Carbon::parse($tanggalSampai)->format('d/m/Y') : 'Semua' }}
    </p>

    <table>
        <thead>
            <tr>
                <th>No. Invoice</th>
                <th>Tanggal</th>
                <th>Customer</th>
                <th>Jatuh Tempo</th>
                <th class="text-right">Total</th>
                <th class="text-right">Terbayar</th>
                <th class="text-right">Sisa</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($invoices as $invoice)
                <tr>
                    <td>{{ $invoice->invoice_number }}</td>
                    <td>{{ $invoice->invoice_date->format('d/m/Y') }}</td>
                    <td>{{ $invoice->customer->name }}</td>
                    <td>{{ $invoice->due_date->format('d/m/Y') }}</td>
                    <td class="text-right">Rp {{ number_format($invoice->grand_total, 0, ',', '.') }}</td>
                    <td class="text-right">Rp {{ number_format($invoice->paid_amount, 0, ',', '.') }}</td>
                    <td class="text-right">Rp {{ number_format($invoice->remainingAmount(), 0, ',', '.') }}</td>
                    <td>{{ $invoice->statusLabel() }}</td>
                </tr>
            @endforeach
            <tr class="total-row">
                <td colspan="4">TOTAL</td>
                <td class="text-right">Rp {{ number_format($invoices->sum('grand_total'), 0, ',', '.') }}</td>
                <td class="text-right">Rp {{ number_format($invoices->sum('paid_amount'), 0, ',', '.') }}</td>
                                <td class="text-right">Rp {{ number_format($invoices->where('status', '!=', 'cancelled')->sum(fn($i) => $i->remainingAmount()), 0, ',', '.') }}</td>
                <td></td>
            </tr>
        </tbody>
    </table>
</body>
</html>