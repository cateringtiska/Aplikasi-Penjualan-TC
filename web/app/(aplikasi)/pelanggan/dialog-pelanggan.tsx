"use client";

import { LoaderCircle, Plus } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { type KeadaanPelanggan, simpanPelanggan } from "./actions";

export type Pelanggan = {
  id: string;
  customer_code: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  npwp: string | null;
  pic_name: string | null;
};

const keadaanAwal: KeadaanPelanggan = {};

export function DialogPelanggan({
  pelanggan,
  terbuka: terbukaLuar,
  onTerbukaChange,
}: {
  pelanggan?: Pelanggan;
  /** Diisi kalau dialog dibuka dari menu aksi baris, bukan dari tombolnya sendiri. */
  terbuka?: boolean;
  onTerbukaChange?: (nilai: boolean) => void;
}) {
  const [terbukaDalam, setTerbukaDalam] = useState(false);
  const [keadaan, kirim, sedangKirim] = useActionState(simpanPelanggan, keadaanAwal);
  const sedangUbah = Boolean(pelanggan);

  const dikendalikan = terbukaLuar !== undefined;
  const terbuka = dikendalikan ? terbukaLuar : terbukaDalam;
  const setTerbuka = dikendalikan ? (onTerbukaChange ?? (() => {})) : setTerbukaDalam;

  useEffect(() => {
    if (keadaan.sukses) {
      toast.success(keadaan.pesan);
      setTerbuka(false);
    }
    // setTerbuka stabil di kedua mode; tidak perlu ikut sebagai kebergantungan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keadaan]);

  return (
    <Dialog open={terbuka} onOpenChange={setTerbuka}>
      {dikendalikan ? null : (
        <DialogTrigger
          render={
            <Button size="sm">
              <Plus className="size-4" />
              Tambah customer
            </Button>
          }
        />
      )}

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{sedangUbah ? "Ubah customer" : "Customer baru"}</DialogTitle>
          <DialogDescription>
            {sedangUbah
              ? `Kode ${pelanggan!.customer_code} tidak bisa diubah.`
              : "Kode customer dibuat otomatis setelah disimpan."}
          </DialogDescription>
        </DialogHeader>

        <form action={kirim} className="flex flex-col gap-4" noValidate>
          {pelanggan ? <input type="hidden" name="id" value={pelanggan.id} /> : null}

          {keadaan.pesan && !keadaan.sukses ? (
            <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {keadaan.pesan}
            </p>
          ) : null}

          <Bidang label="Nama customer" nama="name" galat={keadaan.galat?.name} wajib>
            <Input
              id="name"
              name="name"
              defaultValue={pelanggan?.name ?? ""}
              autoFocus
              placeholder="PT Contoh Sejahtera"
              aria-invalid={Boolean(keadaan.galat?.name)}
            />
          </Bidang>

          <div className="grid gap-4 sm:grid-cols-2">
            <Bidang label="Nama PIC" nama="pic_name" galat={keadaan.galat?.pic_name}>
              <Input
                id="pic_name"
                name="pic_name"
                defaultValue={pelanggan?.pic_name ?? ""}
                placeholder="Ibu Sari"
              />
            </Bidang>

            <Bidang label="Telepon" nama="phone" galat={keadaan.galat?.phone}>
              <Input
                id="phone"
                name="phone"
                inputMode="tel"
                defaultValue={pelanggan?.phone ?? ""}
                placeholder="0812…"
                aria-invalid={Boolean(keadaan.galat?.phone)}
              />
            </Bidang>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Bidang label="Email" nama="email" galat={keadaan.galat?.email}>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={pelanggan?.email ?? ""}
                placeholder="nama@perusahaan.com"
                aria-invalid={Boolean(keadaan.galat?.email)}
              />
            </Bidang>

            <Bidang label="NPWP" nama="npwp" galat={keadaan.galat?.npwp}>
              <Input
                id="npwp"
                name="npwp"
                inputMode="numeric"
                defaultValue={pelanggan?.npwp ?? ""}
                placeholder="00.000.000.0-000.000"
              />
            </Bidang>
          </div>

          <Bidang label="Alamat" nama="address" galat={keadaan.galat?.address}>
            <Textarea
              id="address"
              name="address"
              rows={3}
              defaultValue={pelanggan?.address ?? ""}
              placeholder="Alamat lengkap untuk dicetak di quotation dan invoice"
            />
          </Bidang>

          <DialogFooter className="mt-1">
            <Button type="button" variant="ghost" onClick={() => setTerbuka(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={sedangKirim}>
              {sedangKirim ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                  Menyimpan…
                </>
              ) : (
                "Simpan"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
