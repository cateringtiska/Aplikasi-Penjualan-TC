"use client";

import { ChevronDown } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type OpsiCari = { nilai: string; label: string };

/** Huruf kecil dan spasi dirapatkan, supaya "ibu  usi" cocok dengan "Ibu Usi". */
function rapikan(teks: string) {
  return teks.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Kotak pilih yang bisa diketik: setiap huruf langsung menyaring daftar ke
 * pilihan yang memuat huruf itu — di mana pun letaknya, bukan hanya di
 * depan. Dipakai untuk memilih customer, yang daftarnya terlalu panjang
 * untuk digulir di <select> biasa.
 *
 * Teks di kotak hanya alat mencari. Yang tersimpan tetap `nilai` dari
 * pilihan yang diklik; kalau kotak ditinggalkan tanpa memilih, teksnya
 * kembali ke pilihan terakhir.
 */
export function PilihCari({
  id,
  opsi,
  nilai,
  onPilih,
  placeholder = "Ketik untuk mencari…",
  kosong = "Tidak ada yang cocok.",
  className,
}: {
  id?: string;
  opsi: OpsiCari[];
  nilai: string;
  onPilih: (nilai: string) => void;
  placeholder?: string;
  kosong?: string;
  className?: string;
}) {
  const idDaftar = useId();
  const kotak = useRef<HTMLInputElement>(null);
  const daftar = useRef<HTMLUListElement>(null);

  const terpilih = opsi.find((o) => o.nilai === nilai);
  const [buka, setBuka] = useState(false);
  const [ketikan, setKetikan] = useState<string | null>(null);
  const [sorot, setSorot] = useState(0);

  // Selama tidak sedang mengetik, kotak menampilkan pilihan yang tersimpan.
  const teks = ketikan ?? terpilih?.label ?? "";

  const tersaring = useMemo(() => {
    const kunci = rapikan(ketikan ?? "");
    if (kunci === "") return opsi;
    return opsi.filter((o) => rapikan(o.label).includes(kunci));
  }, [opsi, ketikan]);

  function pilih(o: OpsiCari) {
    // Memilih ulang yang sama tidak boleh mereset apa pun (alokasi pembayaran,
    // kontak yang sudah diketik).
    if (o.nilai !== nilai) onPilih(o.nilai);
    setKetikan(null);
    setBuka(false);
  }

  function tutup() {
    // Kotak dikosongkan lalu ditinggalkan = sengaja melepas pilihannya.
    if (ketikan !== null && ketikan.trim() === "" && nilai !== "") onPilih("");
    setKetikan(null);
    setBuka(false);
  }

  function gulirKe(indeks: number) {
    setSorot(indeks);
    daftar.current
      ?.querySelectorAll<HTMLElement>("[role=option]")
      [indeks]?.scrollIntoView({ block: "nearest" });
  }

  return (
    <div className={cn("relative", className)}>
      <input
        ref={kotak}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={buka}
        aria-controls={idDaftar}
        aria-autocomplete="list"
        aria-activedescendant={buka && tersaring[sorot] ? `${idDaftar}-${sorot}` : undefined}
        autoComplete="off"
        value={teks}
        placeholder={placeholder}
        onFocus={(e) => {
          e.target.select();
          setBuka(true);
        }}
        onClick={() => setBuka(true)}
        onBlur={tutup}
        onChange={(e) => {
          setKetikan(e.target.value);
          setSorot(0);
          setBuka(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!buka) setBuka(true);
            else gulirKe(Math.min(sorot + 1, tersaring.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            gulirKe(Math.max(sorot - 1, 0));
          } else if (e.key === "Enter") {
            // Enter di kotak ini memilih, bukan mengirim formulirnya.
            if (buka && tersaring[sorot]) {
              e.preventDefault();
              pilih(tersaring[sorot]);
            }
          } else if (e.key === "Escape") {
            if (buka) {
              e.preventDefault();
              setKetikan(null);
              setBuka(false);
            }
          }
        }}
        className="h-9 w-full rounded-md border bg-transparent pr-8 pl-3 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      />
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />

      {buka ? (
        <ul
          ref={daftar}
          id={idDaftar}
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover py-1 text-sm text-popover-foreground shadow-lg"
        >
          {tersaring.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">{kosong}</li>
          ) : (
            tersaring.map((o, i) => (
              <li
                key={o.nilai}
                id={`${idDaftar}-${i}`}
                role="option"
                aria-selected={o.nilai === nilai}
                // mousedown, bukan click: klik baru terjadi SETELAH kotaknya
                // kehilangan fokus, dan saat itu daftarnya sudah ditutup.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pilih(o);
                }}
                onMouseEnter={() => setSorot(i)}
                className={cn(
                  "cursor-pointer px-3 py-2",
                  i === sorot && "bg-accent text-accent-foreground",
                  o.nilai === nilai && "font-medium",
                )}
              >
                {o.label}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
