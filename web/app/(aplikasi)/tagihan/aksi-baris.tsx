"use client";

import { Ban, FileText, MoreHorizontal, PencilLine, Trash2, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

  const bolehUbah = status !== "cancelled" && !sudahDibayar;
  const belumLunas = ["unpaid", "partial", "overdue"].includes(status);

  return (
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
        <DropdownMenuItem onSelect={() => router.push(`/tagihan/${id}`)}>
          <FileText className="size-4" />
          Lihat detail
        </DropdownMenuItem>

        {bolehUbah ? (
          <DropdownMenuItem onSelect={() => router.push(`/tagihan/${id}/ubah`)}>
            <PencilLine className="size-4" />
            Ubah
          </DropdownMenuItem>
        ) : null}

        {bolehKelolaUang && belumLunas ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => router.push(`/pembayaran/baru?tagihan=${id}`)}
            >
              <Wallet className="size-4" />
              Catat pembayaran
            </DropdownMenuItem>
          </>
        ) : null}

        {bolehKelolaUang && status !== "cancelled" && !sudahDibayar ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() =>
                jalankan(() => batalkanTagihan(id), `${nomor} dibatalkan.`)
              }
            >
              <Ban className="size-4" />
              Batalkan tagihan
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => jalankan(() => hapusTagihan(id), `${nomor} dihapus.`)}
            >
              <Trash2 className="size-4" />
              Hapus
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
