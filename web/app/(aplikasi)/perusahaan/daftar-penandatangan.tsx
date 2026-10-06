"use client";

import { LoaderCircle, Plus } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { type BarisPenandatangan, ItemPenandatangan } from "./baris-penandatangan";
import { type KeadaanPenandatangan, tambahPenandatangan } from "./penandatangan-actions";

export type { BarisPenandatangan };

const keadaanAwal: KeadaanPenandatangan = {};

export function DaftarPenandatangan({ baris }: { baris: BarisPenandatangan[] }) {
  const [keadaan, kirim, sedangKirim] = useActionState(tambahPenandatangan, keadaanAwal);

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {baris.map((p) => (
          <ItemPenandatangan key={p.id} baris={p} />
        ))}
      </ul>

      {/* Ditambahkan satu per satu, bukan lewat satu formulir besar: tiap
          penandatangan membawa berkas gambarnya sendiri, dan satu formulir
          yang menanggung beberapa unggahan sekaligus gagal seluruhnya kalau
          salah satunya bermasalah. */}
      <form
        action={kirim}
        className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/20 p-3.5"
      >
        <div className="min-w-48 flex-1">
          <Label htmlFor="nama-penandatangan" className="text-xs">
            Nama penandatangan
          </Label>
          <Input
            id="nama-penandatangan"
            name="nama"
            placeholder="Nama lengkap"
            className="mt-1.5"
          />
        </div>

        <div className="min-w-48 flex-1">
          <Label htmlFor="ttd-penandatangan" className="text-xs">
            Tanda tangan
          </Label>
          <Input
            id="ttd-penandatangan"
            name="tanda_tangan"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="mt-1.5"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Boleh menyusul. Sebaiknya PNG berlatar transparan.
          </p>
        </div>

        <Button type="submit" size="sm" disabled={sedangKirim}>
          {sedangKirim ? (
            <>
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Menambahkan…
            </>
          ) : (
            <>
              <Plus className="size-4" />
              Tambah
            </>
          )}
        </Button>

        {keadaan.galat ? (
          <p role="alert" className="w-full text-sm text-destructive">
            {keadaan.galat}
          </p>
        ) : null}
        {keadaan.pesan ? <p className="w-full text-sm text-lunas">{keadaan.pesan}</p> : null}
      </form>
    </div>
  );
}
