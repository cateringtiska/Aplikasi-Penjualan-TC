"use client";

import { MoreHorizontal, PencilLine, Power, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  hapusPenandatangan,
  jejakPenandatangan,
  type KeadaanPenandatangan,
  ubahAktifPenandatangan,
  ubahPenandatangan,
} from "./penandatangan-actions";

export type BarisPenandatangan = {
  id: string;
  nama: string;
  /** Tautan bertanda waktu untuk pratinjau, atau null kalau belum ada. */
  tautanTtd: string | null;
  aktif: boolean;
};

const keadaanAwal: KeadaanPenandatangan = {};

export function ItemPenandatangan({ baris }: { baris: BarisPenandatangan }) {
  const [bukaUbah, setBukaUbah] = useState(false);
  const [bukaHapus, setBukaHapus] = useState(false);
  const [jumlahDokumen, setJumlahDokumen] = useState<number | null>(null);
  const [menunggu, mulai] = useTransition();

  // Dialognya ditutup di dalam aksinya, bukan lewat useEffect yang mengintai
  // hasilnya. Effect semacam itu berjalan lagi setiap kali keadaannya
  // berubah — termasuk ketika pesan yang sama kembali muncul — jadi
  // dialognya bisa tertutup pada saat yang tidak diminta.
  const [keadaan, kirim, sedangKirim] = useActionState(
    async (sebelumnya: KeadaanPenandatangan, data: FormData) => {
      const hasil = await ubahPenandatangan(sebelumnya, data);
      if (hasil.pesan) {
        toast.success(hasil.pesan);
        setBukaUbah(false);
      }
      return hasil;
    },
    keadaanAwal,
  );

  /**
   * Jejak dokumennya dihitung saat dialognya dibuka.
   *
   * Dipasang di dialog Ubah maupun Hapus, dan alasannya sama: mengubah nama
   * ikut mengubah apa yang TERCETAK di dokumen yang sudah terbit, sebab
   * dokumennya membaca baris ini saat dicetak. Untuk membetulkan salah ketik
   * itu memang yang diinginkan; untuk memakai ulang barisnya bagi orang lain
   * itu mengubah dokumen yang sudah dikirim ke customer. Angkanya
   * diperlihatkan supaya bedanya terlihat sebelum disimpan.
   */
  function hitungJejak() {
    setJumlahDokumen(null);
    mulai(async () => {
      try {
        setJumlahDokumen(await jejakPenandatangan(baris.id));
      } catch {
        setJumlahDokumen(0);
      }
    });
  }

  return (
    <>
      <li className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3.5 py-3">
        <span className="flex h-11 w-28 shrink-0 items-center justify-center rounded border bg-muted/30">
          {baris.tautanTtd ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={baris.tautanTtd} alt="" className="max-h-9 w-auto" />
          ) : (
            <span className="text-[0.6875rem] text-muted-foreground">belum ada</span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{baris.nama}</span>
          <span className="text-xs text-muted-foreground">
            {baris.aktif
              ? "Bisa dipilih di dokumen baru"
              : "Nonaktif — tetap tercetak di dokumen lamanya"}
          </span>
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={menunggu}
                aria-label={`Tindakan untuk ${baris.nama}`}
              />
            }
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem
              onClick={() => {
                hitungJejak();
                setBukaUbah(true);
              }}
            >
              <PencilLine className="size-4" />
              Ubah nama atau tanda tangan
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() =>
                mulai(async () => {
                  try {
                    await ubahAktifPenandatangan(baris.id, !baris.aktif);
                    toast.success(
                      baris.aktif ? `${baris.nama} dinonaktifkan.` : `${baris.nama} diaktifkan.`,
                    );
                  } catch (galat) {
                    toast.error(galat instanceof Error ? galat.message : "Gagal mengubah.");
                  }
                })
              }
            >
              <Power className="size-4" />
              {baris.aktif ? "Nonaktifkan" : "Aktifkan"}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                hitungJejak();
                setBukaHapus(true);
              }}
            >
              <Trash2 className="size-4" />
              Hapus permanen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </li>

      <Dialog open={bukaUbah} onOpenChange={setBukaUbah}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ubah penandatangan</DialogTitle>
            <DialogDescription>
              Kosongkan berkasnya kalau hanya namanya yang berubah — tanda tangan yang
              sekarang tetap dipakai.
            </DialogDescription>
          </DialogHeader>

          <form action={kirim} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={baris.id} />

            <div>
              <Label htmlFor={`nama-${baris.id}`}>Nama penandatangan</Label>
              <Input
                id={`nama-${baris.id}`}
                name="nama"
                defaultValue={baris.nama}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor={`ttd-${baris.id}`}>Ganti tanda tangan</Label>
              <Input
                id={`ttd-${baris.id}`}
                name="tanda_tangan"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="mt-1.5"
              />
            </div>

            {jumlahDokumen !== null && jumlahDokumen > 0 ? (
              <p className="rounded-md border bg-muted/40 px-3.5 py-3 text-sm text-muted-foreground">
                Nama ini tercetak di{" "}
                <strong className="text-foreground">{jumlahDokumen} dokumen</strong> yang sudah
                terbit, dan ikut berubah. Untuk membetulkan salah ketik memang itu yang
                diinginkan. Kalau yang dimaksud orang lain,{" "}
                <strong className="text-foreground">tambahkan penandatangan baru</strong>.
              </p>
            ) : null}

            {keadaan.galat ? (
              <p role="alert" className="text-sm text-destructive">
                {keadaan.galat}
              </p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setBukaUbah(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={sedangKirim}>
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={bukaHapus} onOpenChange={setBukaHapus}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus {baris.nama}?</DialogTitle>
            <DialogDescription>
              Barisnya dihapus permanen beserta gambar tanda tangannya, dan tidak bisa
              dikembalikan.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border bg-muted/40 px-3.5 py-3 text-sm">
            {jumlahDokumen === null ? (
              <p className="text-muted-foreground">Menghitung dokumennya…</p>
            ) : jumlahDokumen === 0 ? (
              <p className="text-muted-foreground">
                Belum ada dokumen yang memakainya, jadi tidak ada yang berubah.
              </p>
            ) : (
              <p className="text-muted-foreground">
                Ada <strong className="text-foreground">{jumlahDokumen} dokumen</strong> yang
                memakainya, jadi barisnya{" "}
                <strong className="text-foreground">tidak bisa dihapus</strong>. Pakai{" "}
                <strong className="text-foreground">Nonaktifkan</strong>: ia hilang dari pilihan
                dokumen baru, tetapi tetap tercetak di dokumen lamanya.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setBukaHapus(false)}>
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={menunggu || jumlahDokumen === null || jumlahDokumen > 0}
              onClick={() =>
                mulai(async () => {
                  try {
                    await hapusPenandatangan(baris.id);
                    toast.success(`${baris.nama} dihapus.`);
                    setBukaHapus(false);
                  } catch (galat) {
                    toast.error(galat instanceof Error ? galat.message : "Gagal menghapus.");
                  }
                })
              }
            >
              <Trash2 className="size-4" />
              Hapus permanen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
