"use client";

import { Loader2, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";

/**
 * Kotak pencarian untuk halaman daftar.
 *
 * Bekerja dua lapis:
 * 1. Seketika — setiap huruf langsung menyembunyikan baris tabel yang tidak
 *    memuat kata kuncinya. Tidak menunggu server, jadi terasa secepat
 *    kotak pilih customer.
 * 2. Menyusul — kata kuncinya tetap ditulis ke URL dan dicari database,
 *    supaya jumlah dan total di bawah tabel ikut benar, dan baris yang
 *    cocok lewat kolom yang tidak tampil (misal telepon) ikut muncul.
 *    URL juga membuat hasil pencarian bisa disalin-tempel dan tombol
 *    kembali bekerja wajar.
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
  const kotak = useRef<HTMLInputElement>(null);

  const [nilai, setNilai] = useState(params.get(parameter) ?? "");
  const pertamaKali = useRef(true);

  // Lapis 1: saring baris yang sudah ada di layar. Dijalankan lagi setiap
  // kali server mengirim daftar baru (params berubah), karena pengguna bisa
  // sudah mengetik huruf berikutnya sebelum hasil server tiba.
  // Kalau server sudah menjawab untuk kata kunci yang sama, jawabannya yang
  // dipakai apa adanya: baris yang cocok lewat kolom tak terlihat jangan
  // sampai disembunyikan lagi.
  const kunciServer = (params.get(parameter) ?? "").trim();
  useLayoutEffect(() => {
    saringBarisTabel(kotak.current, nilai.trim() === kunciServer ? "" : nilai);
  }, [nilai, kunciServer, params]);

  // Lapis 2: kirim ke server setelah pengetikan berhenti sebentar.
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
    }, 250);

    return () => clearTimeout(jeda);
    // params sengaja tidak diikutkan: perubahan URL dari sini tidak boleh
    // memicu putaran pencarian berikutnya.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nilai, jalur, parameter, router]);

  const Ikon = menunggu ? Loader2 : Search;

  return (
    <div className="relative w-full sm:max-w-xs">
      <Ikon
        className={`pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground ${menunggu ? "animate-spin" : ""}`}
        aria-hidden="true"
      />
      <Input
        ref={kotak}
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

/** Huruf kecil dan spasi dirapatkan, supaya "Ibu  Usi" cocok dengan "ibu usi". */
function rapikan(teks: string) {
  return teks.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Semua teks di dalam baris, termasuk kolom yang disembunyikan di layar
 * kecil. Potongan teks digabung dengan spasi supaya nama customer dan nama
 * PIC di bawahnya tidak menempel menjadi satu kata.
 */
function teksBaris(baris: HTMLElement) {
  const potongan: string[] = [];
  const jalan = document.createTreeWalker(baris, NodeFilter.SHOW_TEXT);
  while (jalan.nextNode()) potongan.push(jalan.currentNode.textContent ?? "");
  return rapikan(potongan.join(" "));
}

/** Menyembunyikan baris tabel di halaman ini yang tidak memuat kata kunci. */
export function saringBarisTabel(kotak: HTMLElement | null, kataKunci: string) {
  if (!kotak) return;
  const wilayah = kotak.closest("main") ?? document.body;
  const kunci = rapikan(kataKunci);

  wilayah.querySelectorAll<HTMLTableRowElement>("table tbody tr").forEach((baris) => {
    baris.hidden = kunci !== "" && !teksBaris(baris).includes(kunci);
  });
}
