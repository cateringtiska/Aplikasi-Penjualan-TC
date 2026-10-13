"use client";

import { RotateCcw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tanggalSiapDisaring } from "@/lib/bentuk-form";
import { labelPelanggan } from "@/lib/kontak";

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
  pelanggan: { id: string; nama: string; kode: string; pic: string | null }[];
}) {
  const router = useRouter();
  const jalur = usePathname();
  const params = useSearchParams();
  const [, mulai] = useTransition();

  /**
   * Isian tanggal baru dikirim setelah tahunnya SELESAI diketik.
   *
   * Tanpa ini, mengetik "2026" angka demi angka memindahkan halaman pada
   * angka pertama — browser melaporkan tahunnya sebagai 0002 — lalu
   * isiannya digambar ulang dari alamat yang baru dan tiga angka sisanya
   * tidak pernah sampai. Lihat tanggalSiapDisaring di lib/bentuk-form.ts.
   */
  function ubahTanggal(kunci: string, nilai: string) {
    if (!tanggalSiapDisaring(nilai)) return;
    ubah(kunci, nilai);
  }

  function ubah(kunci: string, nilai: string) {
    const baru = new URLSearchParams(params.toString());
    if (nilai) baru.set(kunci, nilai);
    else baru.delete(kunci);
    mulai(() => router.replace(`${jalur}?${baru.toString()}`, { scroll: false }));
  }

  const adaSaring = ["dari", "sampai", "customer"].some((k) => params.get(k));

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
          onChange={(e) => ubahTanggal("dari", e.target.value)}
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
          onChange={(e) => ubahTanggal("sampai", e.target.value)}
          className="h-9 w-40"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="customer" className="text-xs">
          Customer
        </Label>
        <select
          id="customer"
          value={params.get("customer") ?? ""}
          onChange={(e) => ubah("customer", e.target.value)}
          className="h-9 w-56 rounded-md border bg-transparent px-3 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <option value="">Semua customer</option>
          {pelanggan.map((p) => (
            <option key={p.id} value={p.id}>
              {labelPelanggan(p)}
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
