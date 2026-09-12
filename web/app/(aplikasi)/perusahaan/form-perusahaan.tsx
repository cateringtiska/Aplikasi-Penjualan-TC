"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BATAS_SYARAT } from "@/lib/batas";

import { type KeadaanPerusahaan, simpanPerusahaan } from "./actions";

export type IsiPerusahaan = {
  company_name: string;
  signature_name: string;
  bank_name: string;
  bank_account_number: string;
  bank_account_holder: string;
  payment_terms_default: string;
  quotation_terms_default: string;
  logo_path: string | null;
  signature_path: string | null;
};

const keadaanAwal: KeadaanPerusahaan = {};

export function FormPerusahaan({ isi }: { isi: IsiPerusahaan }) {
  const [keadaan, kirim, sedangKirim] = useActionState(simpanPerusahaan, keadaanAwal);

  useEffect(() => {
    if (keadaan.sukses) toast.success(keadaan.pesan);
  }, [keadaan]);

  return (
    <form action={kirim} className="flex max-w-2xl flex-col gap-8" noValidate>
      {keadaan.pesan && !keadaan.sukses ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/25 bg-destructive/5 px-3.5 py-3 text-sm text-destructive"
        >
          {keadaan.pesan}
        </p>
      ) : null}

      <Bagian judul="Identitas" keterangan="Tampil di kepala dokumen quotation dan invoice.">
        <Bidang label="Nama perusahaan" nama="company_name" galat={keadaan.galat?.company_name} wajib>
          <Input
            id="company_name"
            name="company_name"
            defaultValue={isi.company_name}
            placeholder="TISKA Catering"
          />
        </Bidang>

        <div className="grid gap-4 sm:grid-cols-2">
          <BidangGambar
            label="Logo"
            nama="logo"
            galat={keadaan.galat?.logo}
            tautanSekarang={isi.logo_path}
            keterangan="PNG atau JPG, maksimal 2 MB."
          />
          <BidangGambar
            label="Tanda tangan"
            nama="signature"
            galat={keadaan.galat?.signature}
            tautanSekarang={isi.signature_path}
            keterangan="Sebaiknya PNG berlatar transparan."
          />
        </div>

        <Bidang
          label="Nama penanda tangan"
          nama="signature_name"
          galat={keadaan.galat?.signature_name}
        >
          <Input
            id="signature_name"
            name="signature_name"
            defaultValue={isi.signature_name}
            placeholder="Nama yang dicetak di bawah tanda tangan"
          />
        </Bidang>
      </Bagian>

      <Bagian
        judul="Rekening pembayaran"
        keterangan="Dicetak di bagian bawah dokumen sebagai tujuan transfer."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Bidang label="Nama bank" nama="bank_name">
            <Input
              id="bank_name"
              name="bank_name"
              defaultValue={isi.bank_name}
              placeholder="Bank BCA"
            />
          </Bidang>
          <Bidang label="Nomor rekening" nama="bank_account_number">
            <Input
              id="bank_account_number"
              name="bank_account_number"
              defaultValue={isi.bank_account_number}
              placeholder="1234567890"
              className="angka tabular-nums"
            />
          </Bidang>
        </div>

        <Bidang label="Atas nama" nama="bank_account_holder">
          <Input
            id="bank_account_holder"
            name="bank_account_holder"
            defaultValue={isi.bank_account_holder}
          />
        </Bidang>
      </Bagian>

      <Bagian
        judul="Teks standar"
        keterangan="Terisi otomatis saat membuat dokumen baru, dan masih bisa diubah per dokumen."
      >
        <BidangSyarat
          label="Syarat pada quotation"
          nama="quotation_terms_default"
          galat={keadaan.galat?.quotation_terms_default}
          nilaiAwal={isi.quotation_terms_default}
          placeholder="Syarat dan ketentuan pemesanan — boleh berhalaman-halaman."
        />

        <BidangSyarat
          label="Syarat pada invoice"
          nama="payment_terms_default"
          galat={keadaan.galat?.payment_terms_default}
          nilaiAwal={isi.payment_terms_default}
          placeholder="Termin pembayaran, nomor rekening, ketentuan pembatalan."
        />
      </Bagian>

      <div>
        <Button type="submit" disabled={sedangKirim}>
          {sedangKirim ? (
            <>
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Menyimpan…
            </>
          ) : (
            "Simpan pengaturan"
          )}
        </Button>
      </div>
    </form>
  );
}

/**
 * Kotak untuk syarat & ketentuan.
 *
 * Dibuat tinggi dan berpenghitung karakter karena isinya memang panjang —
 * dokumen syarat katering bisa belasan ribu karakter, dengan sepuluh bagian
 * bernomor. Penghitungnya ada supaya batas penyimpanan terlihat sebelum
 * tombol Simpan ditekan, bukan sesudahnya.
 */
function BidangSyarat({
  label,
  nama,
  galat,
  nilaiAwal,
  placeholder,
}: {
  label: string;
  nama: string;
  galat?: string;
  nilaiAwal: string;
  placeholder: string;
}) {
  const [nilai, setNilai] = useState(nilaiAwal);
  const hampirPenuh = nilai.length > BATAS_SYARAT * 0.9;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <Label htmlFor={nama}>{label}</Label>
        <span
          className={`angka text-xs tabular-nums ${hampirPenuh ? "text-tempo" : "text-muted-foreground"}`}
        >
          {nilai.length.toLocaleString("id-ID")} / {BATAS_SYARAT.toLocaleString("id-ID")}
        </span>
      </div>
      <Textarea
        id={nama}
        name={nama}
        rows={14}
        value={nilai}
        onChange={(e) => setNilai(e.target.value)}
        placeholder={placeholder}
        className="font-mono text-xs leading-relaxed"
      />
      {galat ? <p className="text-xs text-destructive">{galat}</p> : null}
    </div>
  );
}

function BidangGambar({
  label,
  nama,
  galat,
  tautanSekarang,
  keterangan,
}: {
  label: string;
  nama: string;
  galat?: string;
  tautanSekarang: string | null;
  keterangan: string;
}) {
  // Berkas lama Laravel tersimpan sebagai jalur relatif di disk server itu,
  // yang tidak bisa dijangkau dari sini. Hanya tautan penuh yang ditampilkan.
  const bisaTampil = tautanSekarang?.startsWith("http") ?? false;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={nama}>{label}</Label>

      <div className="flex h-20 items-center justify-center rounded-md border bg-muted/30 p-2">
        {bisaTampil ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tautanSekarang!} alt={`${label} sekarang`} className="max-h-16 w-auto" />
        ) : (
          <span className="text-xs text-muted-foreground">
            {tautanSekarang ? "Berkas lama tidak terbaca" : "Belum ada"}
          </span>
        )}
      </div>

      <Input
        id={nama}
        name={nama}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="h-auto py-1.5 text-xs file:mr-2 file:text-xs"
      />
      <p className="text-xs text-muted-foreground">{keterangan}</p>
      {galat ? <p className="text-xs text-destructive">{galat}</p> : null}
    </div>
  );
}

function Bagian({
  judul,
  keterangan,
  children,
}: {
  judul: string;
  keterangan?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold tracking-[-0.01em]">{judul}</h2>
        {keterangan ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{keterangan}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Bidang({
  label,
  nama,
  galat,
  wajib,
  children,
}: {
  label: string;
  nama: string;
  galat?: string;
  wajib?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={nama}>
        {label}
        {wajib ? <span className="text-muted-foreground"> *</span> : null}
      </Label>
      {children}
      {galat ? <p className="text-xs text-destructive">{galat}</p> : null}
    </div>
  );
}
