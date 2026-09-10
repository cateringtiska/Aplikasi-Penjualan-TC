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

import { ubahStatusPengguna } from "./actions";
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
  const [menunggu, mulai] = useTransition();

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

        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => setBukaUbah(true)}>
            <PencilLine className="size-4" />
            Ubah data
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={diriSendiri}
            onSelect={() =>
              mulai(async () => {
                try {
                  await ubahStatusPengguna(pengguna.id);
                  toast.success(
                    aktif
                      ? `${pengguna.name} dinonaktifkan.`
                      : `${pengguna.name} diaktifkan kembali.`,
                  );
                } catch (galat) {
                  toast.error(galat instanceof Error ? galat.message : "Gagal mengubah status.");
                }
              })
            }
          >
            <Power className="size-4" />
            {aktif ? "Nonaktifkan" : "Aktifkan"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogPengguna pengguna={pengguna} terbuka={bukaUbah} onTerbukaChange={setBukaUbah} />
    </>
  );
}
