"use client";

import { FileText, MoreHorizontal, PencilLine, Trash2 } from "lucide-react";
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

import { hapusPembayaran } from "./actions";

export function AksiBaris({ id, nomor }: { id: string; nomor: string }) {
  const router = useRouter();
  const [menunggu, mulai] = useTransition();

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

      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => router.push(`/pembayaran/${id}`)}>
          <FileText className="size-4" />
          Lihat detail
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/pembayaran/${id}/ubah`)}>
          <PencilLine className="size-4" />
          Ubah pembayaran
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() =>
            mulai(async () => {
              try {
                await hapusPembayaran(id);
                toast.success(`${nomor} dihapus. Status tagihan terkait sudah diperbarui.`);
              } catch (galat) {
                toast.error(galat instanceof Error ? galat.message : "Gagal menghapus.");
              }
            })
          }
        >
          <Trash2 className="size-4" />
          Hapus pembayaran
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
