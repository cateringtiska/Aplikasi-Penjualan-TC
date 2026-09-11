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

import { type KeadaanProduk, simpanProduk } from "./actions";

export type Produk = {
  id: string;
  product_code: string;
  name: string;
  type: string;
  unit: string;
  default_price: string;
  description: string | null;
};

const keadaanAwal: KeadaanProduk = {};

export function DialogProduk({
  produk,
  terbuka: terbukaLuar,
  onTerbukaChange,
}: {
  produk?: Produk;
  terbuka?: boolean;
  onTerbukaChange?: (nilai: boolean) => void;
}) {
  const [terbukaDalam, setTerbukaDalam] = useState(false);
  const [keadaan, kirim, sedangKirim] = useActionState(simpanProduk, keadaanAwal);
  const sedangUbah = Boolean(produk);

  const dikendalikan = terbukaLuar !== undefined;
  const terbuka = dikendalikan ? terbukaLuar : terbukaDalam;
  const setTerbuka = dikendalikan ? (onTerbukaChange ?? (() => {})) : setTerbukaDalam;

  useEffect(() => {
    if (keadaan.sukses) {
      toast.success(keadaan.pesan);
      setTerbuka(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keadaan]);

  return (
    <Dialog open={terbuka} onOpenChange={setTerbuka}>
      {dikendalikan ? null : (
        <DialogTrigger
          render={
            <Button size="sm">
              <Plus className="size-4" />
              Tambah produk
            </Button>
          }
        />
      )}

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{sedangUbah ? "Ubah produk" : "Produk baru"}</DialogTitle>
          <DialogDescription>
            {sedangUbah
              ? `Kode ${produk!.product_code} tidak bisa diubah.`
              : "Harga di sini hanya harga standar — masih bisa diubah per quotation."}
          </DialogDescription>
        </DialogHeader>

        <form action={kirim} className="flex flex-col gap-4" noValidate>
          {produk ? <input type="hidden" name="id" value={produk.id} /> : null}

          {keadaan.pesan && !keadaan.sukses ? (
            <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {keadaan.pesan}
            </p>
          ) : null}

          <Bidang label="Nama produk" nama="name" galat={keadaan.galat?.name} wajib>
            <Input
              id="name"
              name="name"
              defaultValue={produk?.name ?? ""}
              autoFocus
              placeholder="Paket Buffet Prasmanan"
              aria-invalid={Boolean(keadaan.galat?.name)}
            />
          </Bidang>

          <div className="grid gap-4 sm:grid-cols-2">
            <Bidang label="Jenis" nama="type" galat={keadaan.galat?.type} wajib>
              <div className="flex gap-2" role="radiogroup" aria-label="Jenis produk">
                {(["barang", "jasa"] as const).map((jenis) => (
                  <label
                    key={jenis}
                    className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm capitalize transition-colors has-[:checked]:border-foreground/35 has-[:checked]:bg-accent has-[:checked]:font-medium"
                  >
                    <input
                      type="radio"
                      name="type"
                      value={jenis}
                      defaultChecked={(produk?.type ?? "barang") === jenis}
                      className="sr-only"
                    />
                    {jenis}
                  </label>
                ))}
              </div>
            </Bidang>

            <Bidang label="Satuan" nama="unit" galat={keadaan.galat?.unit} wajib>
              <Input
                id="unit"
                name="unit"
                defaultValue={produk?.unit ?? "pax"}
                placeholder="pax, porsi, unit, hari"
                aria-invalid={Boolean(keadaan.galat?.unit)}
              />
            </Bidang>
          </div>

          <Bidang
            label="Harga standar"
            nama="default_price"
            galat={keadaan.galat?.default_price}
            wajib
          >
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                Rp
              </span>
              <Input
                id="default_price"
                name="default_price"
                inputMode="numeric"
                defaultValue={
                  produk ? Number(produk.default_price).toLocaleString("id-ID") : ""
                }
                placeholder="85.000"
                className="angka pl-9 tabular-nums"
                aria-invalid={Boolean(keadaan.galat?.default_price)}
              />
            </div>
          </Bidang>

          <Bidang label="Keterangan" nama="description" galat={keadaan.galat?.description}>
            <Textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={produk?.description ?? ""}
              placeholder="Isi paket, catatan penyajian, atau minimal pemesanan"
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
