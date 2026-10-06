"use client";

import { LoaderCircle, Plus } from "lucide-react";
import { useActionState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  type KeadaanPenandatangan,
  tambahPenandatangan,
  ubahAktifPenandatangan,
} from "./penandatangan-actions";

export type BarisPenandatangan = {
  id: string;
  nama: string;
  /** Tautan bertanda waktu untuk pratinjau, atau null kalau belum ada. */
  tautanTtd: string | null;
  aktif: boolean;
};

const keadaanAwal: KeadaanPenandatangan = {};

export function DaftarPenandatangan({ baris }: { baris: BarisPenandatangan[] }) {
  const [keadaan, kirim, sedangKirim] = useActionState(tambahPenandatangan, keadaanAwal);
  const [menunggu, mulai] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {baris.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3.5 py-3"
          >
            <span className="flex h-11 w-28 shrink-0 items-center justify-center rounded border bg-muted/30">
              {p.tautanTtd ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.tautanTtd} alt="" className="max-h-9 w-auto" />
              ) : (
                <span className="text-[0.6875rem] text-muted-foreground">belum ada</span>
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{p.nama}</span>
              <span className="text-xs text-muted-foreground">
                {p.aktif ? "Bisa dipilih di dokumen baru" : "Nonaktif — tetap tercetak di dokumen lamanya"}
              </span>
            </span>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={menunggu}
              onClick={() =>
                mulai(async () => {
                  try {
                    await ubahAktifPenandatangan(p.id, !p.aktif);
                    toast.success(p.aktif ? `${p.nama} dinonaktifkan.` : `${p.nama} diaktifkan.`);
                  } catch (galat) {
                    toast.error(galat instanceof Error ? galat.message : "Gagal mengubah.");
                  }
                })
              }
            >
              {p.aktif ? "Nonaktifkan" : "Aktifkan"}
            </Button>
          </li>
        ))}
      </ul>

      {/* Ditambahkan satu per satu, bukan lewat satu formulir besar: tiap
          penandatangan membawa berkas gambarnya sendiri, dan satu formulir
          yang menanggung beberapa unggahan sekaligus gagal seluruhnya kalau
          salah satunya bermasalah. */}
      <form action={kirim} className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/20 p-3.5">
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
        {keadaan.pesan ? (
          <p className="w-full text-sm text-lunas">{keadaan.pesan}</p>
        ) : null}
      </form>
    </div>
  );
}
