"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Penyaring status berbentuk deretan tab.
 *
 * Pilihannya ditulis ke alamat halaman seperti kotak pencarian, sehingga
 * "semua tagihan jatuh tempo" adalah tautan yang bisa dikirim ke orang lain.
 */
export function SaringStatus({
  pilihan,
  parameter = "status",
}: {
  pilihan: { nilai: string; label: string; jumlah?: number }[];
  parameter?: string;
}) {
  const router = useRouter();
  const jalur = usePathname();
  const params = useSearchParams();
  const aktif = params.get(parameter) ?? "";

  function pilih(nilai: string) {
    const baru = new URLSearchParams(params.toString());
    if (nilai) baru.set(parameter, nilai);
    else baru.delete(parameter);
    router.replace(`${jalur}?${baru.toString()}`, { scroll: false });
  }

  return (
    <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {pilihan.map((p) => {
        const terpilih = aktif === p.nilai;
        return (
          <button
            key={p.nilai || "semua"}
            type="button"
            onClick={() => pilih(p.nilai)}
            aria-pressed={terpilih}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[0.8125rem] whitespace-nowrap transition-colors",
              terpilih
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/55 hover:text-foreground",
            )}
          >
            {p.label}
            {typeof p.jumlah === "number" ? (
              <span className="angka text-xs tabular-nums opacity-60">{p.jumlah}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
