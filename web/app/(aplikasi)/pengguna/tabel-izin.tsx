"use client";

import { LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Peran } from "@/lib/auth";
import { type KunciMenu, LABEL_PERAN } from "@/lib/navigasi";

import { simpanIzin } from "./izin-actions";

export type BarisIzin = {
  kunci: KunciMenu;
  label: string;
  kelompok: string;
  hanyaAdmin: boolean;
  /** Keadaan sekarang per peran yang bisa diatur. */
  izin: Record<string, boolean>;
};

/* ==========================================================================
   MENGATUR HAK AKSES

   KOLOM ADMIN TIDAK BISA DICENTANG. Admin selalu lolos, dan membuatnya
   tampak bisa dimatikan akan menawarkan sesuatu yang tidak akan terjadi —
   lebih buruk lagi kalau suatu saat benar-benar terjadi: satu centang yang
   terlepas akan mengunci pemiliknya keluar dari halaman yang justru dipakai
   untuk memperbaikinya.

   HALAMAN PENGATURAN JUGA TIDAK BISA DIBERIKAN. Halaman User bisa membuat
   admin baru, dan admin baru bisa membuka seluruh halaman lain; memberikan
   halaman ini ke peran lain diam-diam membatalkan setiap pembatasan yang
   lain. Alasannya ditulis di layar, bukan hanya di kode — yang melihat
   kotak mati berhak tahu kenapa.
   ========================================================================== */

export function TabelIzin({
  baris,
  peranDiatur,
}: {
  baris: BarisIzin[];
  peranDiatur: Exclude<Peran, "admin">[];
}) {
  const [izin, setIzin] = useState<Record<string, boolean>>(() => {
    const awal: Record<string, boolean> = {};
    for (const b of baris) {
      for (const p of peranDiatur) awal[`${p}:${b.kunci}`] = b.izin[p] ?? false;
    }
    return awal;
  });

  const [menyimpan, mulai] = useTransition();

  const awal = JSON.stringify(
    Object.fromEntries(
      baris.flatMap((b) => peranDiatur.map((p) => [`${p}:${b.kunci}`, b.izin[p] ?? false])),
    ),
  );
  const berubah = JSON.stringify(izin) !== awal;

  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <Th>Halaman</Th>
            <Th className="w-24 text-center">{LABEL_PERAN.admin}</Th>
            {peranDiatur.map((p) => (
              <Th key={p} className="w-24 text-center">
                {LABEL_PERAN[p]}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {baris.map((b) => (
            <tr key={b.kunci} className="border-b last:border-0">
              <Td>
                <span>{b.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">{b.kelompok}</span>
                {b.hanyaAdmin ? (
                  <span className="block text-xs text-muted-foreground">
                    Hanya admin — halaman ini bisa membuat admin baru.
                  </span>
                ) : null}
              </Td>

              <Td className="text-center">
                <span className="text-lunas" title="Admin selalu boleh">
                  ✓
                </span>
              </Td>

              {peranDiatur.map((p) => {
                const kunci = `${p}:${b.kunci}`;
                return (
                  <Td key={p} className="text-center">
                    {b.hanyaAdmin ? (
                      <span className="text-muted-foreground/40" aria-label="tidak bisa diberikan">
                        —
                      </span>
                    ) : (
                      <Checkbox
                        checked={izin[kunci] ?? false}
                        onCheckedChange={(v) =>
                          setIzin((lama) => ({ ...lama, [kunci]: v === true }))
                        }
                        aria-label={`${LABEL_PERAN[p]} boleh membuka ${b.label}`}
                      />
                    )}
                  </Td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          {berubah
            ? "Ada perubahan yang belum disimpan."
            : "Perubahan berlaku segera setelah disimpan, termasuk untuk yang sedang membuka aplikasi."}
        </p>

        <Button
          size="sm"
          disabled={!berubah || menyimpan}
          onClick={() =>
            mulai(async () => {
              try {
                await simpanIzin(izin);
                toast.success("Hak akses disimpan.");
              } catch (galat) {
                toast.error(galat instanceof Error ? galat.message : "Gagal menyimpan.");
              }
            })
          }
        >
          {menyimpan ? (
            <>
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Menyimpan…
            </>
          ) : (
            "Simpan hak akses"
          )}
        </Button>
      </div>
    </>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-2.5 text-left text-[0.6875rem] font-medium tracking-[0.06em] text-muted-foreground uppercase ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className ?? ""}`}>{children}</td>;
}
