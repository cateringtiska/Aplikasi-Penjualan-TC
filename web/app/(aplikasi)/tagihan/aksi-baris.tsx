"use client";

import { Ban, FileText, MoreHorizontal, PencilLine, Trash2, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { DialogPembatalan } from "@/components/dialog-pembatalan";

import { batalkanTagihan, hapusTagihan } from "./actions";

export function AksiBaris({
  id,
  nomor,
  status,
  sudahDibayar,
  bolehKelolaUang,
}: {
  id: string;
  nomor: string;
  status: string;
  sudahDibayar: boolean;
  bolehKelolaUang: boolean;
}) {
  const router = useRouter();
  const [menunggu, mulai] = useTransition();
  const [bukaBatal, setBukaBatal] = useState(false);

  function jalankan(kerja: () => Promise<void>, pesanSukses: string) {
    mulai(async () => {
      try {
        await kerja();
        toast.success(pesanSukses);
      } catch (galat) {
        toast.error(galat instanceof Error ? galat.message : "Tindakan gagal.");
      }
    });
  }

  // Invoice yang sudah menerima payment TETAP boleh diubah: tambahan menu
  // saat acara berlangsung adalah kejadian biasa. Yang menjaga adalah aturan
  // di simpan.ts — nilainya tidak boleh jatuh di bawah uang yang sudah
  // masuk. Lihat catatan di sana.
  const bolehUbah = status !== "cancelled";
  const belumLunas = ["unpaid", "partial", "overdue"].includes(status);

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
            aria-label={`Tindakan untuk ${nomor}`}
          />
        }
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => router.push(`/tagihan/${id}`)}>
          <FileText className="size-4" />
          Lihat detail
        </DropdownMenuItem>

        {bolehUbah ? (
          <DropdownMenuItem onClick={() => router.push(`/tagihan/${id}/ubah`)}>
            <PencilLine className="size-4" />
            Ubah
          </DropdownMenuItem>
        ) : null}

        {bolehKelolaUang && belumLunas ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => router.push(`/pembayaran/baru?tagihan=${id}`)}
            >
              <Wallet className="size-4" />
              Catat pembayaran
            </DropdownMenuItem>
          </>
        ) : null}

        {bolehKelolaUang && status !== "cancelled" && !sudahDibayar ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setBukaBatal(true)}>
              <Ban className="size-4" />
              Batalkan invoice
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => jalankan(() => hapusTagihan(id), `${nomor} dihapus.`)}
            >
              <Trash2 className="size-4" />
              Hapus
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>

    <DialogPembatalan
      terbuka={bukaBatal}
      onTerbukaChange={setBukaBatal}
      judul={`Batalkan ${nomor}?`}
      keterangan="Invoice tetap tersimpan dan tetap terlihat di daftar, tetapi ditandai dibatalkan dan tidak lagi dihitung sebagai piutang."
      labelTombol="Batalkan invoice"
      onBatalkan={async (alasan) => {
        await batalkanTagihan(id, alasan);
        toast.success(`${nomor} dibatalkan.`);
        router.refresh();
      }}
    />
    </>
  );
}
