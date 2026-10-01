import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { FileSpreadsheet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  BingkaiTabel,
  Halaman,
  KeadaanKosong,
  KepalaHalaman,
  RingkasanTabel,
} from "@/components/halaman";
import { KartuAngka, PapanAngka } from "@/components/kartu-angka";
import { Pencarian } from "@/components/pencarian";
import { Button } from "@/components/ui/button";
import { ambilPiutang, KELOMPOK } from "@/lib/laporan-piutang";
import { wajibPeran } from "@/lib/rbac";
import { rupiah } from "@/lib/uang";

export const metadata: Metadata = { title: "Kartu piutang" };
export const dynamic = "force-dynamic";

/** Hijau, kuning, oranye, merah — menanjak mengikuti umur keterlambatan. */
const WARNA_UMUR = {
  belum: "hijau",
  h1: "kuning",
  h31: "oranye",
  h60: "merah",
} as const;

export default async function HalamanPiutang({ searchParams }: PageProps<"/laporan/piutang">) {
  await wajibPeran("sales", "finance");

  const { cari } = await searchParams;
  const kunci = typeof cari === "string" ? cari.trim() : "";

  const { daftar, umur, totalSemua, lunas } = await ambilPiutang(kunci);

  return (
    <Halaman>
      <KepalaHalaman
        judul="Kartu piutang"
        keterangan="Sisa invoice per customer, dikelompokkan menurut umur keterlambatannya."
        aksi={
          <Button variant="outline" size="sm" render={<a href={`/laporan/piutang/excel${kunci ? `?cari=${encodeURIComponent(kunci)}` : ""}`} />}>
            <FileSpreadsheet className="size-4" />
            Excel
          </Button>
        }
      />

      {/* Warnanya menanjak mengikuti umur — hijau, kuning, oranye, merah —
          supaya kelompok mana yang paling perlu ditindaklanjuti terbaca
          tanpa harus membandingkan angkanya satu per satu. */}
      <PapanAngka className="mb-6">
        {KELOMPOK.map((k) => (
          <KartuAngka
            key={k.kunci}
            label={k.label}
            nilai={rupiah(umur[k.kunci])}
            warna={WARNA_UMUR[k.kunci]}
          />
        ))}
      </PapanAngka>

      <div className="pb-4">
        <Pencarian placeholder="Cari nama customer…" />
      </div>

      <BingkaiTabel>
        {daftar.length === 0 ? (
          lunas.length > 0 ? (
            /* Halaman kosong terbaca sebagai "pembayaran saya tidak tercatat",
               padahal artinya justru sebaliknya. Jadi sebutkan siapa yang sudah
               lunas, berapa yang sudah masuk, dan ke mana riwayatnya bisa
               dilihat. */
            <div className="px-4 py-8 sm:px-6">
              <p className="text-center text-sm font-medium">
                {kunci ? `Tidak ada sisa piutang atas nama "${kunci}".` : "Tidak ada piutang."}
              </p>
              <p className="mx-auto mt-1 max-w-md text-center text-sm text-muted-foreground">
                Bukan berarti pembayarannya tidak tercatat — justru sebaliknya. Yang berikut ini
                sudah lunas seluruhnya, jadi ia keluar dari daftar umur piutang.
              </p>

              <ul className="mx-auto mt-5 flex max-w-md flex-col gap-2">
                {lunas.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-md border bg-card px-3.5 py-2.5"
                  >
                    <Link
                      href={`/pelanggan/${p.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {p.nama}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {p.jumlahInvoice} invoice · {rupiah(p.totalDibayar)} lunas
                    </span>
                  </li>
                ))}
              </ul>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                Klik namanya untuk melihat kartu piutangnya — seluruh invoice dan pembayaran,
                termasuk yang sudah lunas.
              </p>
            </div>
          ) : (
            <KeadaanKosong
              judul={kunci ? "Tidak ada yang cocok" : "Tidak ada piutang"}
              keterangan={
                kunci
                  ? `Tidak ada customer bernama "${kunci}" yang punya invoice.`
                  : "Semua invoice sudah lunas. Tidak ada yang perlu ditagih."
              }
            />
          )
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <Th>Customer</Th>
                <Th className="hidden w-28 sm:table-cell">Invoice</Th>
                <Th className="hidden w-40 md:table-cell">Jatuh tempo tertua</Th>
                <Th className="w-32 text-right">Terlambat</Th>
                <Th className="w-40 text-right">Sisa piutang</Th>
              </tr>
            </thead>
            <tbody>
              {daftar.map((p) => (
                <tr key={p.idPelanggan} className="border-b last:border-0 hover:bg-muted/25">
                  <Td>
                    <Link
                      href={`/pelanggan/${p.idPelanggan}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {p.nama}
                    </Link>
                    <span className="nomor-dokumen block text-muted-foreground">{p.kode}</span>
                  </Td>
                  <Td className="hidden text-muted-foreground sm:table-cell">
                    {p.jumlahTagihan} lembar
                  </Td>
                  <Td className="hidden text-muted-foreground md:table-cell">
                    {format(p.tempoTertua, "d MMM yyyy", { locale: localeId })}
                  </Td>
                  <Td className="angka text-right tabular-nums">
                    {p.hariTerlambat > 0 ? (
                      <span className={p.hariTerlambat > 60 ? "font-medium text-tempo" : ""}>
                        {p.hariTerlambat} hari
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Td>
                  <Td className="angka text-right font-medium tabular-nums">
                    {rupiah(p.total)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </BingkaiTabel>

      {daftar.length > 0 ? (
        <RingkasanTabel>
          {daftar.length} customer · total piutang {rupiah(totalSemua)}
        </RingkasanTabel>
      ) : null}
    </Halaman>
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
  return <td className={`px-4 py-3 align-middle ${className ?? ""}`}>{children}</td>;
}
