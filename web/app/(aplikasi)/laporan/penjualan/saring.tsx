"use client";

import { RotateCcw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Penyaring laporan.
 *
 * Semua pilihannya tersimpan di alamat halaman, jadi hasil laporan bisa
 * dikirim sebagai tautan — termasuk ke tombol ekspor, yang tinggal membawa
 * parameter yang sama.
 */
export function SaringLaporan({
  pelanggan,
}: {
  pelanggan: { id: string; nama: string }[];
}) {
  const router = useRouter();
  const jalur = usePathname();
  const params = useSearchParams();
  const [, mulai] = useTransition();

  function ubah(kunci: string, nilai: string) {
    const baru = new URLSearchParams(params.toString());
    if (nilai) baru.set(kunci, nilai);
    else baru.delete(kunci);
    mulai(() => router.replace(`${jalur}?${baru.toString()}`, { scroll: false }));
  }

  const adaSaring = ["dari", "sampai", "pelanggan"].some((k) => params.get(k));

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="dari" className="text-xs">
          Dari tanggal
        </Label>
        <Input
          id="dari"
          type="date"
          value={params.get("dari") ?? ""}
          onChange={(e) => ubah("dari", e.target.value)}
          className="h-9 w-40"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="sampai" className="text-xs">
          Sampai tanggal
        </Label>
        <Input
          id="sampai"
          type="date"
          value={params.get("sampai") ?? ""}
          onChange={(e) => ubah("sampai", e.target.value)}
          className="h-9 w-40"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="pelanggan" className="text-xs">
          Pelanggan
        </Label>
        <select
          id="pelanggan"
          value={params.get("pelanggan") ?? ""}
          onChange={(e) => ubah("pelanggan", e.target.value)}
          className="h-9 w-56 rounded-md border bg-transparent px-3 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <option value="">Semua pelanggan</option>
          {pelanggan.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nama}
            </option>
          ))}
        </select>
      </div>

      {adaSaring ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => mulai(() => router.replace(jalur, { scroll: false }))}
        >
          <RotateCcw className="size-4" />
          Reset
        </Button>
      ) : null}
    </div>
  );
}
