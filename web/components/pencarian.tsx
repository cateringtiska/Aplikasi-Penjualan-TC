"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";

/**
 * Kotak pencarian yang menulis ke alamat halaman.
 *
 * Kata kuncinya disimpan di URL, bukan di dalam komponen. Akibatnya hasil
 * pencarian bisa disalin-tempel ke orang lain, tombol kembali bekerja wajar,
 * dan penyaringan tetap dikerjakan database — bukan di browser seperti
 * aplikasi Laravel-nya, yang menarik seluruh tabel setiap ketikan.
 *
 * Pengetikan ditunda 300 milidetik supaya tidak ada satu permintaan per huruf.
 */
export function Pencarian({
  placeholder = "Cari…",
  parameter = "cari",
}: {
  placeholder?: string;
  parameter?: string;
}) {
  const router = useRouter();
  const jalur = usePathname();
  const params = useSearchParams();
  const [menunggu, mulaiTransisi] = useTransition();

  const [nilai, setNilai] = useState(params.get(parameter) ?? "");
  const pertamaKali = useRef(true);

  useEffect(() => {
    if (pertamaKali.current) {
      pertamaKali.current = false;
      return;
    }

    const jeda = setTimeout(() => {
      const baru = new URLSearchParams(params.toString());
      if (nilai.trim()) baru.set(parameter, nilai.trim());
      else baru.delete(parameter);

      mulaiTransisi(() => {
        router.replace(`${jalur}?${baru.toString()}`, { scroll: false });
      });
    }, 300);

    return () => clearTimeout(jeda);
    // params sengaja tidak diikutkan: perubahan URL dari sini tidak boleh
    // memicu putaran pencarian berikutnya.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nilai, jalur, parameter, router]);

  return (
    <div className="relative w-full sm:max-w-xs">
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        id={`cari-${parameter}`}
        type="search"
        value={nilai}
        onChange={(e) => setNilai(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
        data-menunggu={menunggu ? "" : undefined}
      />
      {nilai ? (
        <button
          type="button"
          onClick={() => setNilai("")}
          aria-label="Kosongkan pencarian"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
