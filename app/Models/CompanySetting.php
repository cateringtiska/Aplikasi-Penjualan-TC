<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['company_name', 'bank_name', 'bank_account_number', 'bank_account_holder', 'logo_path', 'signature_path', 'payment_terms_default', 'quotation_terms_default'])]
class CompanySetting extends Model
{
    public static function current(): self
    {
        return static::firstOrCreate(
            ['id' => 1],
            ['company_name' => 'Nama Perusahaan Anda']
        );
    }
}