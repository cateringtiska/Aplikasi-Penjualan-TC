<?php

use App\Http\Controllers\InvoicePdfController;
use App\Http\Controllers\QuotationPdfController;
use App\Livewire\Dashboard;
use App\Livewire\FormInvoice;
use App\Livewire\FormPembayaran;
use App\Livewire\FormQuotation;
use App\Livewire\KartuPiutang;
use App\Livewire\LaporanPenjualan;
use App\Livewire\ManajemenCustomer;
use App\Livewire\ManajemenInvoice;
use App\Livewire\ManajemenPembayaran;
use App\Livewire\ManajemenProduk;
use App\Livewire\ManajemenQuotation;
use App\Livewire\ManajemenUser;
use App\Livewire\PengaturanPerusahaan;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Quotation;
use App\Livewire\LaporanMargin;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'role:admin,finance'])->group(function () {
    Route::get('/laporan-margin', LaporanMargin::class)->name('reports.margin');
});
Route::view('/', 'welcome');

Route::get('dashboard', Dashboard::class)
    ->middleware(['auth', 'verified'])
    ->name('dashboard');

Route::view('profile', 'profile')
    ->middleware(['auth'])
    ->name('profile');

require __DIR__.'/auth.php';

Route::middleware(['auth', 'role:admin'])->group(function () {
    Route::get('/percobaan-admin', fn () => 'Halaman ini khusus Admin. Kalau Anda lihat ini, berarti berhasil!');
});

Route::middleware(['auth', 'role:sales'])->group(function () {
    Route::get('/percobaan-sales', fn () => 'Halaman ini khusus Sales.');
});

Route::middleware(['auth', 'role:finance'])->group(function () {
    Route::get('/percobaan-finance', fn () => 'Halaman ini khusus Finance.');
});

Route::middleware(['auth', 'role:admin'])->group(function () {
    Route::get('/pengaturan/user', ManajemenUser::class)->name('users.index');
});

Route::middleware(['auth', 'role:admin'])->group(function () {
    Route::get('/pengaturan', PengaturanPerusahaan::class)->name('settings.company');
});

Route::middleware(['auth', 'role:admin,sales,finance'])->group(function () {
    Route::get('/master/customer', ManajemenCustomer::class)->name('customers.index');
    Route::get('/master/customer/{customer}/histori', function (Customer $customer) {
        $quotations = Quotation::where('customer_id', $customer->id)->orderByDesc('quotation_date')->get();
        $invoices = Invoice::where('customer_id', $customer->id)->orderByDesc('invoice_date')->get();
        $totalPiutang = $invoices->whereIn('status', ['unpaid', 'partial', 'overdue'])->sum(fn ($i) => $i->remainingAmount());

        return view('customers.histori', [
            'customer' => $customer,
            'quotations' => $quotations,
            'invoices' => $invoices,
            'totalPiutang' => $totalPiutang,
        ]);
    })->name('customers.histori');
});

Route::middleware(['auth', 'role:admin,sales,finance'])->group(function () {
    Route::get('/master/produk', ManajemenProduk::class)->name('products.index');
});

Route::middleware(['auth', 'role:admin,sales,finance'])->group(function () {
    Route::get('/quotation', ManajemenQuotation::class)->name('quotations.index');
    Route::get('/quotation/create', FormQuotation::class)->name('quotations.create');
    Route::get('/quotation/{id}/edit', FormQuotation::class)->name('quotations.edit');
    Route::get('/quotation/{quotation}/pdf', [QuotationPdfController::class, 'show'])->name('quotations.pdf');
    Route::get('/quotation/{quotation}', function (Quotation $quotation) {
        $quotation->load(['items' => fn ($q) => $q->whereNull('parent_id')->with('children'), 'customer']);
        return view('quotations.show', ['quotation' => $quotation]);
    })->name('quotations.show');

    Route::get('/invoice', ManajemenInvoice::class)->name('invoices.index');
    Route::get('/invoice/create', FormInvoice::class)->name('invoices.create');
    Route::get('/invoice/{id}/edit', FormInvoice::class)->name('invoices.edit');
    Route::get('/invoice/{invoice}/pdf', [InvoicePdfController::class, 'show'])->name('invoices.pdf');
    Route::get('/invoice/{invoice}', function (Invoice $invoice) {
        $invoice->load(['items' => fn ($q) => $q->whereNull('parent_id')->with('children'), 'customer', 'quotation']);
        return view('invoices.show', ['invoice' => $invoice]);
    })->name('invoices.show');
});

Route::middleware(['auth', 'role:admin,finance'])->group(function () {
    Route::get('/pembayaran', ManajemenPembayaran::class)->name('payments.index');
    Route::get('/pembayaran/create', FormPembayaran::class)->name('payments.create');
    Route::get('/pembayaran/{payment}', function (Payment $payment) {
        $payment->load('details.invoice', 'customer');
        return view('payments.show', ['payment' => $payment]);
    })->name('payments.show');
});

Route::middleware(['auth', 'role:admin,sales,finance'])->group(function () {
    Route::get('/laporan-penjualan', LaporanPenjualan::class)->name('reports.penjualan');
});

Route::middleware(['auth', 'role:admin,sales,finance'])->group(function () {
    Route::get('/piutang', KartuPiutang::class)->name('reports.piutang');
});