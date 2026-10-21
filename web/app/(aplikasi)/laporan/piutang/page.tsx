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
import { KepalaTabel, Th } from "@/components/tabel";
import { ringkasTanggalAcaraPendek } from "@/lib/tanggal";
import { ambilPiutang, KELOMPOK } from "@/lib/laporan-piutang";
import { hanyaMiliknya, wajibIzin } from "@/lib/rbac";
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
  const sesi = await wajibIzin("laporan-piutang");

  const { cari } = await searchParams;
  const kunci = typeof cari === "string" ? cari.trim() : "";

  const { daftar, jumlahPelanggan, umur, totalSemua, belumTerjadi, lunas } = await ambilPiutang(
    kunci,
    hanyaMiliknya(sesi),
  );

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

      {/* Invoice yang acaranya belum terjadi TIDAK ikut ke piutang mana pun —
          menagih sesuatu yang belum diserahkan bukan piutang. Tetapi uangnya
          tetap harus ditagih, jadi angkanya disebutkan di sini. Tanpa ini,
          invoice yang baru terbit terlihat seperti hilang dari aplikasi. */}
      {belumTerjadi.jumlahInvoice > 0 ? (
        <div className="mb-6 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
          <p className="font-medium">
            {belumTerjadi.jumlahInvoice} invoice belum masuk piutang karena acaranya belum
            terjadi
          </p>
          <p className="mt-1 text-muted-foreground">
            Proyeksi penjualan {rupiah(belumTerjadi.proyeksi)} · lunas di muka{" "}
            {rupiah(belumTerjadi.diterimaDiMuka)}. Dari proyeksi itu,{" "}
            {rupiah(belumTerjadi.uangMuka)} sudah masuk sebagai uang muka. Sisanya menjadi
            piutang begitu acaranya lewat.
          </p>
        </div>
      ) : null}

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
                Bukan berarti payment-nya tidak tercatat — justru sebaliknya. Yang berikut ini
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
            <KepalaTabel>
              <Th>Customer</Th>
              {/* Satu baris satu invoice. Dirangkum per customer, kolom
                  tanggalnya terpaksa menyebut yang TERTUA di antara
                  beberapa invoice — pasangan tanggal yang tidak pernah
                  ada pada satu dokumen pun, dan tidak cocok dengan daftar
                  invoicenya. */}
              <Th className="hidden w-36 sm:table-cell">No. Invoice</Th>
              <Th className="hidden w-32 md:table-cell">Tanggal</Th>
              <Th className="hidden w-32 md:table-cell">Jatuh tempo</Th>
              <Th className="w-32 text-right">Terlambat</Th>
              <Th className="w-40 text-right">Sisa piutang</Th>
            </KepalaTabel>
            <tbody>
              {daftar.map((p) => (
                <tr key={p.idTagihan} className="border-b last:border-0 hover:bg-muted/25">
                  <Td>
                    <Link
                      href={`/pelanggan/${p.idPelanggan}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {p.nama}
                    </Link>
                    <span className="nomor-dokumen block text-muted-foreground">
                      {p.kode}
                      {/* PIC disebut di sini, bukan di kolom sendiri: yang
                          dicari orang saat membuka halaman ini adalah siapa
                          yang harus ditelepon, dan itu menempel pada namanya. */}
                      {p.pic ? <span className="ml-2">· {p.pic}</span> : null}
                    </span>
                  </Td>
                  <Td className="hidden sm:table-cell">
                    <Link
                      href={`/tagihan/${p.idTagihan}`}
                      className="nomor-dokumen underline-offset-4 hover:underline"
                    >
                      {p.nomor}
                    </Link>
                    {/* Tanggal acaranya menempel pada nomor invoicenya,
                        bukan di kolom sendiri: halaman ini sudah punya dua
                        kolom tanggal — invoice dan jatuh tempo — dan yang
                        ketiga membuat ketiganya tertukar saat dibaca
                        sekilas. */}
                    {ringkasTanggalAcaraPendek(p.tanggalAcara) ? (
                      <span className="block text-xs text-muted-foreground">
                        {ringkasTanggalAcaraPendek(p.tanggalAcara)}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="hidden text-muted-foreground md:table-cell whitespace-nowrap">
                    {format(p.tanggal, "d MMM yyyy", { locale: localeId })}
                  </Td>
                  <Td className="hidden text-muted-foreground md:table-cell whitespace-nowrap">
                    {format(p.tempo, "d MMM yyyy", { locale: localeId })}
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
                    {rupiah(p.sisa)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </BingkaiTabel>

      {daftar.length > 0 ? (
        <RingkasanTabel>
          {daftar.length} invoice dari {jumlahPelanggan} customer · total piutang{" "}
          {rupiah(totalSemua)}
        </RingkasanTabel>
      ) : null}
    </Halaman>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className ?? ""}`}>{children}</td>;
}
