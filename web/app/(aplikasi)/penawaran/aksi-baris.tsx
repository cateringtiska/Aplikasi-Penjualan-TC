"use client";

import {
  Check,
  FileText,
  MoreHorizontal,
  PencilLine,
  Send,
  Trash2,
  X,
} from "lucide-react";
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

import { hapusPenawaran, ubahStatusPenawaran } from "./actions";

export function AksiBaris({
  id,
  nomor,
  status,
}: {
  id: string;
  nomor: string;
  status: string;
}) {
  const router = useRouter();
  const [menunggu, mulai] = useTransition();
  const [bukaTolak, setBukaTolak] = useState(false);

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

  const bolehUbah = status !== "approved";
  const bolehHapus = status === "draft";

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

      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => router.push(`/penawaran/${id}`)}>
          <FileText className="size-4" />
          Lihat detail
        </DropdownMenuItem>

        {bolehUbah ? (
          <DropdownMenuItem onClick={() => router.push(`/penawaran/${id}/ubah`)}>
            <PencilLine className="size-4" />
            Ubah
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuSeparator />

        {status === "draft" ? (
          <DropdownMenuItem
            onClick={() =>
              jalankan(
                () => ubahStatusPenawaran(id, "sent"),
                `${nomor} ditandai terkirim.`,
              )
            }
          >
            <Send className="size-4" />
            Tandai terkirim
          </DropdownMenuItem>
        ) : null}

        {status === "sent" ? (
          <>
            <DropdownMenuItem
              onClick={() =>
                jalankan(
                  () => ubahStatusPenawaran(id, "approved"),
                  `${nomor} disetujui pelanggan.`,
                )
              }
            >
              <Check className="size-4" />
              Tandai disetujui
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                setBukaTolak(true)
              }
            >
              <X className="size-4" />
              Tandai ditolak
            </DropdownMenuItem>
          </>
        ) : null}

        {status === "expired" || status === "rejected" ? (
          <DropdownMenuItem
            onClick={() =>
              jalankan(() => ubahStatusPenawaran(id, "sent"), `${nomor} dikirim ulang.`)
            }
          >
            <Send className="size-4" />
            Kirim ulang
          </DropdownMenuItem>
        ) : null}

        {bolehHapus ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => jalankan(() => hapusPenawaran(id), `${nomor} dihapus.`)}
            >
              <Trash2 className="size-4" />
              Hapus
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>

    <DialogPembatalan
      terbuka={bukaTolak}
      onTerbukaChange={setBukaTolak}
      judul={`Tandai ${nomor} ditolak?`}
      keterangan="Quotation tetap tersimpan. Statusnya menjadi ditolak, dan nilainya tidak lagi dihitung sebagai proyeksi penjualan."
      labelTombol="Tandai ditolak"
      onBatalkan={async (alasan) => {
        await ubahStatusPenawaran(id, "rejected", alasan);
        toast.success(`${nomor} ditandai ditolak.`);
        router.refresh();
      }}
    />
    </>
  );
}
