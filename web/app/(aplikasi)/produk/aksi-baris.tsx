"use client";

import { MoreHorizontal, PencilLine, Power } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ubahStatusProduk } from "./actions";
import { DialogProduk, type Produk } from "./dialog-produk";

export function AksiBaris({ produk, aktif }: { produk: Produk; aktif: boolean }) {
  const [bukaUbah, setBukaUbah] = useState(false);
  const [menunggu, mulai] = useTransition();

  function gantiStatus() {
    mulai(async () => {
      try {
        await ubahStatusProduk(produk.id);
        toast.success(
          aktif ? `${produk.name} dinonaktifkan.` : `${produk.name} diaktifkan kembali.`,
        );
      } catch {
        toast.error("Status gagal diubah. Coba lagi.");
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
              aria-label={`Tindakan untuk ${produk.name}`}
            />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setBukaUbah(true)}>
            <PencilLine className="size-4" />
            Ubah data
          </DropdownMenuItem>
          <DropdownMenuItem onClick={gantiStatus}>
            <Power className="size-4" />
            {aktif ? "Nonaktifkan" : "Aktifkan"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogProduk produk={produk} terbuka={bukaUbah} onTerbukaChange={setBukaUbah} />
    </>
  );
}
