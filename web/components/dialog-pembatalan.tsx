"use client";

import { Ban, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { bacaAlasanPembatalan, MAX_ALASAN } from "@/lib/pembatalan";

/* ==========================================================================
   MENANYAKAN ALASAN SEBELUM MEMBATALKAN

   Dokumen yang dibatalkan tetap ada di daftar dan tetap terhitung di
   laporan, tetapi tanpa keterangan kenapa. Beberapa minggu kemudian tidak
   seorang pun bisa menjawabnya, dan yang bertanya biasanya customer itu
   sendiri atau akuntan saat menutup bulan.

   Alasannya diperiksa DI SINI DAN DI SERVER, dengan aturan yang sama.
   Pemeriksaan di layar hanya kenyamanan — ia bisa dilewati siapa pun yang
   memanggil tindakannya langsung, dan pembatalan tanpa alasan yang lolos
   lewat jalan itu tetap akan menjadi dokumen tanpa keterangan.
   ========================================================================== */

export function DialogPembatalan({
  terbuka,
  onTerbukaChange,
  judul,
  keterangan,
  labelTombol = "Batalkan",
  onBatalkan,
}: {
  terbuka: boolean;
  onTerbukaChange: (nilai: boolean) => void;
  judul: string;
  keterangan: string;
  labelTombol?: string;
  onBatalkan: (alasan: string) => Promise<void>;
}) {
  const [alasan, setAlasan] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const [menunggu, mulai] = useTransition();

  function kirim() {
    const baca = bacaAlasanPembatalan(alasan);
    if (!baca.ok) {
      setGalat(baca.pesan);
      return;
    }

    setGalat(null);
    mulai(async () => {
      try {
        await onBatalkan(baca.alasan);
        setAlasan("");
        onTerbukaChange(false);
      } catch (e) {
        // Galat dari server ditampilkan DI DALAM dialognya, bukan sebagai
        // notifikasi yang lewat: yang mengetik alasannya masih berdiri di
        // sini, dan alasannya jangan sampai hilang.
        setGalat(e instanceof Error ? e.message : "Gagal membatalkan.");
      }
    });
  }

  return (
    <Dialog
      open={terbuka}
      onOpenChange={(nilai) => {
        if (!nilai) setGalat(null);
        onTerbukaChange(nilai);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{judul}</DialogTitle>
          <DialogDescription>{keterangan}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="alasan-pembatalan">
            Alasan pembatalan<span className="text-muted-foreground"> *</span>
          </Label>
          <Textarea
            id="alasan-pembatalan"
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            placeholder="Customer membatalkan acara, diganti QUO-2026-0012, salah terbit…"
            rows={3}
            maxLength={MAX_ALASAN}
          />
          <p className="text-xs text-muted-foreground">
            Tercatat beserta tanggal dan nama Anda, dan terlihat di halaman dokumennya.
          </p>

          {galat ? (
            <p role="alert" className="text-sm text-destructive">
              {galat}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onTerbukaChange(false)}>
            Kembali
          </Button>
          <Button type="button" variant="destructive" disabled={menunggu} onClick={kirim}>
            {menunggu ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Ban className="size-4" />
            )}
            {labelTombol}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
