"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

      <Bagian judul="Identitas" keterangan="Tampil di kepala dokumen penawaran dan tagihan.">
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
        <Bidang label="Syarat pada penawaran" nama="quotation_terms_default">
          <Textarea
            id="quotation_terms_default"
            name="quotation_terms_default"
            rows={4}
            defaultValue={isi.quotation_terms_default}
            placeholder="Harga berlaku 14 hari. Uang muka 50% saat pemesanan."
          />
        </Bidang>

        <Bidang label="Syarat pada tagihan" nama="payment_terms_default">
          <Textarea
            id="payment_terms_default"
            name="payment_terms_default"
            rows={4}
            defaultValue={isi.payment_terms_default}
            placeholder="Pelunasan paling lambat H-3 sebelum acara."
          />
        </Bidang>
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
