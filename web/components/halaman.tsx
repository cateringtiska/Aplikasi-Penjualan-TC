import { cn } from "@/lib/utils";

/**
 * Kerangka satu halaman daftar.
 *
 * Sengaja dibuat sekali di sini dan dipakai ulang oleh semua modul, supaya
 * jarak, ukuran judul, dan letak tombol tidak bergeser sedikit pun antar
 * halaman. Pergeseran kecil semacam itu yang membuat aplikasi terasa
 * dirakit, bukan dirancang.
 */

export function Halaman({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-10">{children}</div>;
}

export function KepalaHalaman({
  judul,
  keterangan,
  aksi,
}: {
  judul: string;
  keterangan?: string;
  aksi?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 pb-6">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-[-0.02em]">{judul}</h1>
        {keterangan ? (
          <p className="mt-1 text-sm text-muted-foreground">{keterangan}</p>
        ) : null}
      </div>
      {aksi ? <div className="flex shrink-0 items-center gap-2">{aksi}</div> : null}
    </header>
  );
}

/** Bingkai tabel: satu garis tepi, sudut membulat, isi bisa digeser mendatar. */
export function BingkaiTabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border-strong bg-card shadow-sm", className)}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function KeadaanKosong({
  judul,
  keterangan,
  aksi,
}: {
  judul: string;
  keterangan?: string;
  aksi?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 py-16 text-center">
      <p className="text-sm font-medium">{judul}</p>
      {keterangan ? (
        <p className="max-w-sm text-sm text-muted-foreground">{keterangan}</p>
      ) : null}
      {aksi ? <div className="mt-4">{aksi}</div> : null}
    </div>
  );
}

/** Baris ringkasan di bawah tabel: "12 pelanggan · 9 aktif". */
export function RingkasanTabel({ children }: { children: React.ReactNode }) {
  return <p className="pt-3 text-xs text-muted-foreground">{children}</p>;
}
