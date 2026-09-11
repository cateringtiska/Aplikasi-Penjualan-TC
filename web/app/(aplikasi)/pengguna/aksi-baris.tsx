"use client";

import { MoreHorizontal, PencilLine, Power, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
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

import { hapusPengguna, jejakPengguna, ubahStatusPengguna } from "./actions";
import { DialogPengguna, type Pengguna } from "./dialog-pengguna";

export function AksiBaris({
  pengguna,
  aktif,
  diriSendiri,
}: {
  pengguna: Pengguna;
  aktif: boolean;
  diriSendiri: boolean;
}) {
  const [bukaUbah, setBukaUbah] = useState(false);
  const [bukaHapus, setBukaHapus] = useState(false);
  const [jumlahDokumen, setJumlahDokumen] = useState<number | null>(null);
  const [menunggu, mulai] = useTransition();

  function bukaKonfirmasiHapus() {
    setJumlahDokumen(null);
    setBukaHapus(true);

    // Jejak dokumennya dihitung saat dialog dibuka, supaya admin tahu apa
    // yang akan kehilangan keterangan pembuat sebelum menekan Hapus.
    mulai(async () => {
      try {
        setJumlahDokumen(await jejakPengguna(pengguna.id));
      } catch {
        setJumlahDokumen(0);
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={menunggu}
              aria-label={`Tindakan untuk ${pengguna.name}`}
            />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => setBukaUbah(true)}>
            <PencilLine className="size-4" />
            Ubah data
          </DropdownMenuItem>

          <DropdownMenuItem
            disabled={diriSendiri}
            onClick={() =>
              mulai(async () => {
                try {
                  await ubahStatusPengguna(pengguna.id);
                  toast.success(
                    aktif
                      ? `${pengguna.name} dinonaktifkan.`
                      : `${pengguna.name} diaktifkan kembali.`,
                  );
                } catch (galat) {
                  toast.error(
                    galat instanceof Error ? galat.message : "Gagal mengubah status.",
                  );
                }
              })
            }
          >
            <Power className="size-4" />
            {aktif ? "Nonaktifkan" : "Aktifkan"}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            variant="destructive"
            disabled={diriSendiri}
            onClick={bukaKonfirmasiHapus}
          >
            <Trash2 className="size-4" />
            Hapus permanen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogPengguna pengguna={pengguna} terbuka={bukaUbah} onTerbukaChange={setBukaUbah} />

      <Dialog open={bukaHapus} onOpenChange={setBukaHapus}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus {pengguna.name}?</DialogTitle>
            <DialogDescription>
              Akun <span className="font-mono">{pengguna.username}</span> dihapus permanen dan
              tidak bisa dikembalikan.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border bg-muted/40 px-3.5 py-3 text-sm">
            {jumlahDokumen === null ? (
              <p className="text-muted-foreground">Menghitung dokumennya…</p>
            ) : jumlahDokumen === 0 ? (
              <p className="text-muted-foreground">
                Pengguna ini belum pernah membuat dokumen apa pun.
              </p>
            ) : (
              <p className="text-muted-foreground">
                Ada <strong className="text-foreground">{jumlahDokumen} dokumen</strong> yang
                mencantumkannya sebagai pembuat. Dokumennya{" "}
                <strong className="text-foreground">tetap utuh</strong> — hanya keterangan
                pembuatnya yang hilang.
              </p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Kalau orangnya hanya berhenti bekerja, <strong>Nonaktifkan</strong> lebih baik:
            akunnya tidak bisa dipakai masuk, tetapi keterangan pembuat dokumennya tetap
            terbaca.
          </p>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setBukaHapus(false)}>
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={menunggu}
              onClick={() =>
                mulai(async () => {
                  try {
                    await hapusPengguna(pengguna.id);
                    toast.success(`${pengguna.name} dihapus permanen.`);
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
