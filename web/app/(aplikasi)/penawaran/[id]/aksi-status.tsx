"use client";

import { Check, LoaderCircle, Send, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { DialogPembatalan } from "@/components/dialog-pembatalan";
import { Button } from "@/components/ui/button";

import { ubahStatusPenawaran } from "../actions";

/* ==========================================================================
   LANGKAH BERIKUTNYA UNTUK SEBUAH QUOTATION

   Tombol ini sebelumnya hanya ada di menu "…" pada DAFTAR quotation. Padahal
   keputusan menyetujui diambil justru saat dokumennya sedang dibaca — di
   halaman detail ini. Orang yang membukanya lalu tidak menemukan jalan maju
   menyimpulkan tombolnya belum dibuat, dan memang begitulah yang terjadi.

   Yang ditampilkan hanya SATU langkah berikutnya, bukan seluruh kemungkinan
   status. Urutannya: draft -> terkirim -> disetujui, lalu barulah tombol
   "Buat invoice" muncul. Urutan itu dijaga di server; di sini hanya
   ditampilkan supaya terlihat.
   ========================================================================== */

export function AksiStatusPenawaran({
  id,
  nomor,
  status,
}: {
  id: string;
  nomor: string;
  status: string;
}) {
  const [menunggu, mulai] = useTransition();
  const [bukaTolak, setBukaTolak] = useState(false);

  // Tindakan server dipanggil DI DALAM transisi. Di luar transisi, kegagalan
  // apa pun menjatuhkan halaman tanpa meninggalkan jejak di log server.
  function jalankan(tujuan: string, pesan: string) {
    mulai(async () => {
      try {
        await ubahStatusPenawaran(id, tujuan);
        toast.success(pesan);
      } catch (galat) {
        toast.error(galat instanceof Error ? galat.message : "Tindakan gagal.");
      }
    });
  }

  const berputar = <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />;

  if (status === "draft") {
    return (
      <Button size="sm" disabled={menunggu} onClick={() => jalankan("sent", `${nomor} ditandai terkirim.`)}>
        {menunggu ? berputar : <Send className="size-4" />}
        Tandai terkirim
      </Button>
    );
  }

  if (status === "sent") {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          disabled={menunggu}
          onClick={() => setBukaTolak(true)}
        >
          <X className="size-4" />
          Ditolak
        </Button>
        <Button
          size="sm"
          disabled={menunggu}
          onClick={() => jalankan("approved", `${nomor} disetujui pelanggan.`)}
        >
          {menunggu ? berputar : <Check className="size-4" />}
          Tandai disetujui
        </Button>

        <DialogPembatalan
          terbuka={bukaTolak}
          onTerbukaChange={setBukaTolak}
          judul={`Tandai ${nomor} ditolak?`}
          keterangan="Quotation tetap tersimpan. Statusnya menjadi ditolak, dan nilainya tidak lagi dihitung sebagai proyeksi penjualan."
          labelTombol="Tandai ditolak"
          onBatalkan={async (alasan) => {
            await ubahStatusPenawaran(id, "rejected", alasan);
            toast.success(`${nomor} ditandai ditolak.`);
          }}
        />
      </>
    );
  }

  if (status === "expired" || status === "rejected") {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={menunggu}
        onClick={() => jalankan("sent", `${nomor} dikirim ulang.`)}
      >
        {menunggu ? berputar : <Send className="size-4" />}
        Kirim ulang
      </Button>
    );
  }

  // Sudah disetujui: langkah berikutnya bukan status lagi, melainkan tombol
  // "Buat invoice" yang dirender halaman.
  return null;
}
