import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  BingkaiTabel,
  Halaman,
  KeadaanKosong,
  KepalaHalaman,
  RingkasanTabel,
} from "@/components/halaman";
import { StatusTagihan } from "@/components/lencana-status";
import { Pencarian } from "@/components/pencarian";
import { SaringStatus } from "@/components/saring-status";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { BarisKontak } from "@/components/baris-kontak";
import { namaPic } from "@/lib/kontak";
import {
  cocokSaringPengakuan,
  LABEL_SARING_PENGAKUAN,
  pengakuanDokumen,
  saringPengakuanSah,
} from "@/lib/pengakuan";
import { tanggalAcaraDokumen } from "@/lib/tanggal";
import { hanyaMiliknya, wajibIzin } from "@/lib/rbac";
import { d, rupiah } from "@/lib/uang";

import { tandaiJatuhTempo } from "./actions";
import { AksiBaris } from "./aksi-baris";

export const metadata: Metadata = { title: "Invoice" };
export const dynamic = "force-dynamic";

const STATUS = [
  { nilai: "", label: "Semua" },
  { nilai: "unpaid", label: "Belum dibayar" },
  { nilai: "partial", label: "Sebagian" },
  { nilai: "overdue", label: "Jatuh tempo" },
  { nilai: "paid", label: "Lunas" },
  { nilai: "cancelled", label: "Dibatalkan" },
];

export default async function HalamanTagihan({ searchParams }: PageProps<"/tagihan">) {
  const sesi = await wajibIzin("tagihan");

  await tandaiJatuhTempo();

  const { cari, status, pengakuan } = await searchParams;
  const kunci = typeof cari === "string" ? cari.trim() : "";
  const saring = typeof status === "string" ? status : "";

  // Penyaring dari kartu Dashboard. Keputusannya diambil di lib/pengakuan.ts,
  // modul yang sama yang dipakai Dashboard untuk menghitung kartunya —
  // kalau keduanya menyaring sendiri-sendiri, kartunya menyebut sebelas
  // sementara daftarnya berisi sembilan, tanpa galat apa pun.
  const saringPengakuan =
    typeof pengakuan === "string" && saringPengakuanSah(pengakuan) ? pengakuan : null;

  const semua = await prisma.invoices.findMany({
    where: {
      ...hanyaMiliknya(sesi),
      ...(saring ? { status: saring } : {}),
      ...(kunci
        ? {
            OR: [
              { invoice_number: { contains: kunci, mode: "insensitive" } },
              { customers: { name: { contains: kunci, mode: "insensitive" } } },
              { event_type: { contains: kunci, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { id: "desc" },
    select: {
      id: true,
      invoice_number: true,
      invoice_date: true,
      due_date: true,
      event_type: true,
      grand_total: true,
      paid_amount: true,
      status: true,
      contact_person: true,
      customers: { select: { name: true, pic_name: true } },
      // Hanya dibutuhkan penyaring pengakuan. Kolom lamanya ikut diambil:
      // sebagian besar invoice menyimpan tanggal acaranya HANYA di situ.
      event_date: true,
      event_days: true,
      invoice_event_dates: { select: { event_date: true } },
    },
  });

  // Disaring SESUDAH terambil, bukan di dalam kueri: pengakuan adalah
  // keputusan per dokumen yang tidak bisa dinyatakan sebagai syarat SQL.
  const sekarang = new Date();
  const daftar = saringPengakuan
    ? semua.filter((t) =>
        cocokSaringPengakuan(
          saringPengakuan,
          {
            hasil: pengakuanDokumen(
              {
                grand_total: t.grand_total,
                paid_amount: t.paid_amount,
                tanggalAcara: tanggalAcaraDokumen(
                  t.invoice_event_dates,
                  t.event_date,
                  t.event_days,
                ),
              },
              sekarang,
            ),
            dueDate: t.due_date,
            acaraTerakhir: tanggalAcaraDokumen(
              t.invoice_event_dates,
              t.event_date,
              t.event_days,
            ).reduce<Date | null>((a, b) => (a === null || b > a ? b : a), null),
          },
          sekarang,
        ),
      )
    : semua;

  const bolehKelolaUang = sesi.peran === "admin" || sesi.peran === "finance";

  const sisaTotal = daftar
    .filter((t) => t.status !== "cancelled" && t.status !== "paid")
    .reduce((jumlah, t) => jumlah.plus(d(t.grand_total).minus(d(t.paid_amount))), d(0));

  return (
    <Halaman>
      <KepalaHalaman
        judul="Invoice"
        keterangan="Invoice yang sudah terbit beserta sisa yang belum dibayar."
        aksi={
          <Button size="sm" render={<Link href="/tagihan/baru" />}>
            <Plus className="size-4" />
            Buat invoice
          </Button>
        }
      />

      {/* Datang dari kartu Dashboard. Tanpa keterangan ini, daftar yang
          isinya lebih sedikit daripada biasanya terbaca sebagai dokumen
          yang hilang — dan tidak ada petunjuk bahwa ia sedang disaring,
          apalagi cara melepasnya. */}
      {saringPengakuan ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 px-3.5 py-3 text-sm">
          <span>
            Menampilkan <b>{LABEL_SARING_PENGAKUAN[saringPengakuan]}</b> —{" "}
            {daftar.length} invoice.
          </span>
          <Link
            href="/tagihan"
            className="text-xs underline underline-offset-4 hover:text-foreground"
          >
            Tampilkan semua
          </Link>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 pb-4">
        <Pencarian placeholder="Cari nomor, customer, atau jenis acara…" />
        <SaringStatus pilihan={STATUS} />
      </div>

      <BingkaiTabel>
        {daftar.length === 0 ? (
          <KeadaanKosong
            judul={kunci || saring ? "Tidak ada yang cocok" : "Belum ada invoice"}
            keterangan={
              kunci || saring
                ? "Coba ubah kata kunci atau penyaring statusnya."
                : "Invoice biasanya dibuat dari quotation yang sudah disetujui."
            }
            aksi={
              kunci || saring ? undefined : (
                <Button size="sm" render={<Link href="/tagihan/baru" />}>
                  <Plus className="size-4" />
                  Buat invoice
                </Button>
              )
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <Th className="w-36">Nomor</Th>
                <Th>Customer</Th>
                <Th className="hidden w-32 lg:table-cell">Jatuh tempo</Th>
                <Th className="w-36 text-right">Nilai</Th>
                <Th className="w-36 text-right">Sisa</Th>
                <Th className="w-32">Status</Th>
                <Th className="w-12"><span className="sr-only">Tindakan</span></Th>
              </tr>
            </thead>
            <tbody>
              {daftar.map((t) => {
                const sisa = d(t.grand_total).minus(d(t.paid_amount));
                const lunas = t.status === "paid";
                return (
                  <tr key={t.id.toString()} className="border-b last:border-0 hover:bg-muted/25">
                    <Td>
                      <Link
                        href={`/tagihan/${t.id}`}
                        className="nomor-dokumen underline-offset-4 hover:underline"
                      >
                        {t.invoice_number}
                      </Link>
                      {/* Tanggal terbitnya ditaruh di bawah nomornya, bukan
                          sebagai kolom tersendiri: kolom Jatuh tempo justru
                          disembunyikan di layar sempit, dan tanggal invoice
                          adalah keterangan yang dicari bersama nomornya —
                          "invoice bulan lalu yang mana". */}
                      <span className="block text-xs text-muted-foreground">
                        {format(t.invoice_date, "d MMM yyyy", { locale: localeId })}
                      </span>
                    </Td>
                    <Td>
                      <span className="font-medium">{t.customers.name}</span>
                      <BarisKontak
                        pic={namaPic(t.contact_person, t.customers.pic_name)}
                        acara={t.event_type}
                      />
                    </Td>
                    <Td className="hidden text-muted-foreground lg:table-cell">
                      {format(t.due_date, "d MMM yyyy", { locale: localeId })}
                    </Td>
                    <Td className="angka text-right tabular-nums text-muted-foreground">
                      {rupiah(t.grand_total)}
                    </Td>
                    <Td className="angka text-right font-medium tabular-nums">
                      {lunas || t.status === "cancelled" ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        rupiah(sisa)
                      )}
                    </Td>
                    <Td>
                      <StatusTagihan status={t.status} />
                    </Td>
                    <Td className="text-right">
                      <AksiBaris
                        id={t.id.toString()}
                        nomor={t.invoice_number}
                        status={t.status}
                        sudahDibayar={Number(t.paid_amount) > 0}
                        bolehKelolaUang={bolehKelolaUang}
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </BingkaiTabel>

      {daftar.length > 0 ? (
        <RingkasanTabel>
          {daftar.length} tagihan · sisa belum dibayar {rupiah(sisaTotal)}
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

/**
 * Baris kedua di kolom Customer: siapa yang dihubungi, dan acaranya apa.
 *
 * Keduanya ditaruh pada SATU baris supaya daftarnya tidak memanjang ke
 * bawah — daftar yang tiap barisnya tiga baris tinggi memuat separuh lebih
 * sedikit invoice dalam satu layar.
 */
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className ?? ""}`}>{children}</td>;
}
