<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: sans-serif; font-size: 11px; color: #333; }
        table.header-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        table.header-table td { border: 1px solid #999; padding: 4px 6px; vertical-align: top; }
        .title-bar { background-color: #ddd; padding: 8px; font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 10px; }
        table.event-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        table.event-table td { border: 1px solid #999; padding: 4px 6px; }
        table.items-table { width: 100%; border-collapse: collapse; }
        table.items-table th, table.items-table td { border: 1px solid #999; padding: 5px; text-align: left; vertical-align: top; }
        table.items-table th { background-color: #f0f0f0; }
        .text-right { text-align: right; }
        .sub-item { color: #666; font-size: 10px; margin: 1px 0 1px 12px; }
        .total-row td { font-weight: bold; background-color: #f9f9f9; }
        .logo { height: 50px; }
        .bank-info { margin-top: 15px; text-align: center; font-size: 10px; }
        .payment-terms { margin-top: 15px; font-size: 10px; border: 1px solid #999; padding: 8px; }
        .payment-terms .title { font-weight: bold; margin-bottom: 4px; }
        table.signature-table { width: 100%; margin-top: 30px; border-collapse: collapse; }
        table.signature-table td { border: none; padding: 0 10px; vertical-align: top; font-size: 11px; }
        .signature-img { height: 50px; margin: 5px 0; }
        .signature-logo { height: 18px; vertical-align: middle; margin-right: 4px; }
        .signature-line { border-top: 1px solid #333; width: 200px; margin-top: 40px; }
    </style>
    </style>
</head>
<body>
    @if ($company->logo_path)
        <img src="{{ storage_path('app/public/' . $company->logo_path) }}" class="logo">
    @endif

    <table class="header-table">
        <tr>
            <td width="50%"><strong>Account Name:</strong> {{ $quotation->customer->name }}</td>
            <td width="25%"><strong>UP - Kepada:</strong> {{ $quotation->contact_person ?: '-' }}</td>
            <td width="25%"><strong>No. Quotation:</strong> {{ $quotation->quotation_number }}</td>
        </tr>
        <tr>
            <td><strong>Alamat:</strong> {{ $quotation->customer->address ?: '-' }}</td>
            <td><strong>Phone:</strong> {{ $quotation->contact_phone ?: '-' }}</td>
            <td><strong>Tanggal:</strong> {{ $quotation->quotation_date->format('d/m/Y') }}</td>
        </tr>
    </table>

    <div class="title-bar">QUOTATION{{ $quotation->event_type ? ' - ' . strtoupper($quotation->event_type) : '' }}</div>

    @if ($quotation->event_date || $quotation->venue)
        <table class="event-table">
            <tr>
                <td><strong>Tanggal Acara:</strong> {{ $quotation->event_date?->format('d/m/Y') ?? '-' }}</td>
                <td><strong>Jumlah Hari:</strong> {{ $quotation->event_days ?? '-' }}</td>
                <td><strong>Jumlah Tamu:</strong> {{ $quotation->guest_count ?? '-' }}</td>
            </tr>
            <tr>
                <td><strong>F&B Planner:</strong> {{ $quotation->fnb_planner ?? '-' }}</td>
                <td><strong>Jam:</strong> {{ $quotation->event_time ?? '-' }}</td>
                <td><strong>Lokasi:</strong> {{ $quotation->venue ?? '-' }}</td>
            </tr>
        </table>
    @endif

    <table class="items-table">
        <thead>
            <tr>
                <th width="5%">No</th>
                <th>Deskripsi</th>
                <th width="8%">Qty</th>
                <th width="10%">Satuan</th>
                <th width="15%" class="text-right">Harga</th>
                <th width="15%" class="text-right">Subtotal</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($quotation->items as $i => $item)
                <tr>
                    <td>{{ \App\Support\RomanNumeral::convert($i + 1) }}</td>
                    <td>
                        {{ $item->item_name }}
                        @foreach ($item->children as $child)
                            <div class="sub-item">- {{ $child->item_name }}</div>
                        @endforeach
                    </td>
                    <td>{{ $item->qty }}</td>
                    <td>{{ $item->unit }}</td>
                    <td class="text-right">{{ $item->is_compliment ? 'Compliment' : 'Rp ' . number_format($item->price, 0, ',', '.') }}</td>
                    <td class="text-right">{{ $item->is_compliment ? 'Compliment' : 'Rp ' . number_format($item->subtotal, 0, ',', '.') }}</td>
                </tr>
            @endforeach
            <tr class="total-row">
                <td colspan="5">Sub Total</td>
                <td class="text-right">Rp {{ number_format($quotation->subtotal, 0, ',', '.') }}</td>
            </tr>
            @if ($quotation->service_charge_percent)
                <tr class="total-row">
                    <td colspan="5">Service Charge ({{ rtrim(rtrim(number_format($quotation->service_charge_percent, 2), '0'), '.') }}%)</td>
                    <td class="text-right">Rp {{ number_format($quotation->service_charge_amount, 0, ',', '.') }}</td>
                </tr>
            @endif
            @if ($quotation->pb1_enabled)
            <tr class="total-row">
            <td colspan="5">PB1 ({{ rtrim(rtrim(number_format($quotation->pb1_percent, 2), '0'), '.') }}%)</td>
            <td class="text-right">Rp {{ number_format($quotation->pb1_amount, 0, ',', '.') }}</td>
            </tr>
            @endif
            <tr class="total-row">
                <td colspan="5">TOTAL</td>
                <td class="text-right">Rp {{ number_format($quotation->grand_total, 0, ',', '.') }}</td>
            </tr>
        </tbody>
    </table>

        @if ($quotation->notes)
        <p><strong>Catatan:</strong> {{ $quotation->notes }}</p>
    @endif

    @if ($quotation->show_payment_terms && $quotation->payment_terms)
        <div class="payment-terms">
            <div class="title">Syarat & Ketentuan / Termin Pembayaran:</div>
            <div style="white-space: pre-line;">{{ $quotation->payment_terms }}</div>
        </div>
    @endif

        @if ($company->bank_name)
        <div class="bank-info">
            Pembayaran via transfer ke Rekening: <strong>{{ $company->bank_name }}</strong><br>
            Nomor Rekening: <strong>{{ $company->bank_account_number }}</strong> a.n. <strong>{{ $company->bank_account_holder }}</strong>
        </div>
    @endif

    <table class="signature-table">
        <tr>
            <td width="50%">
                Hormat Kami,<br><br>
                @if ($company->signature_path)
                    <img src="{{ storage_path('app/public/' . $company->signature_path) }}" class="signature-img"><br>
                @else
                    <div style="height: 60px;"></div>
                @endif
                <strong>Ida Raodah</strong><br>
                @if ($company->logo_path)
                    <img src="{{ storage_path('app/public/' . $company->logo_path) }}" class="signature-logo">
                @endif
                TISKA Catering
            </td>
            <td width="50%">
                Persetujuan Klien,<br><br>
                <div style="height: 60px;"></div>
                <div class="signature-line"></div>
            </td>
        </tr>
    </table>
</body>
</html>