import { differenceInCalendarDays, format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import type { Metadata } from "next";
import Link from "next/link";

import {
  BingkaiTabel,
  Halaman,
  KeadaanKosong,
  KepalaHalaman,
  RingkasanTabel,
} from "@/components/halaman";
import { Pencarian } from "@/components/pencarian";
import { prisma } from "@/lib/prisma";
import { wajibPeran } from "@/lib/rbac";
import { d, rupiah } from "@/lib/uang";

export const metadata: Metadata = { title: "Kartu piutang" };
export const dynamic = "force-dynamic";

/**
 * Umur piutang.
 *
 * Pengelompokannya mengikuti kebiasaan penagihan: yang belum jatuh tempo,
 * lalu tiga kelompok keterlambatan. Kelompok 60+ hari adalah yang biasanya
 * perlu ditindaklanjuti secara khusus.
 */
const KELOMPOK = [
  { kunci: "belum", label: "Belum jatuh tempo" },
  { kunci: "h1", label: "1–30 hari" },
  { kunci: "h31", label: "31–60 hari" },
  { kunci: "h60", label: "Lebih dari 60 hari" },
] as const;

type KunciKelompok = (typeof KELOMPOK)[number]["kunci"];

export default async function HalamanPiutang({ searchParams }: PageProps<"/laporan/piutang">) {
  await wajibPeran("sales", "finance");

  const { cari } = await searchParams;
  const kunci = typeof cari === "string" ? cari.trim() : "";

  const hariIni = new Date();
  hariIni.setHours(0, 0, 0, 0);

  const tagihan = await prisma.invoices.findMany({
    where: {
      status: { in: ["unpaid", "partial", "overdue"] },
      ...(kunci ? { customers: { name: { contains: kunci, mode: "insensitive" } } } : {}),
    },
    orderBy: { due_date: "asc" },
    select: {
      id: true,
      invoice_number: true,
      due_date: true,
      grand_total: true,
      paid_amount: true,
      customer_id: true,
      customers: { select: { id: true, name: true, customer_code: true } },
    },
  });

  // Dikelompokkan per pelanggan, karena penagihan dilakukan per pelanggan —
  // bukan per lembar tagihan.
  const perPelanggan = new Map<
    string,
    {
      nama: string;
      kode: string;
      idPelanggan: string;
      jumlahTagihan: number;
      total: ReturnType<typeof d>;
      tempoTertua: Date;
      hariTerlambat: number;
    }
  >();

  const umur: Record<KunciKelompok, ReturnType<typeof d>> = {
    belum: d(0),
    h1: d(0),
    h31: d(0),
    h60: d(0),
  };

  for (const t of tagihan) {
    const sisa = d(t.grand_total).minus(d(t.paid_amount));
    if (sisa.lte(0)) continue;

    const terlambat = differenceInCalendarDays(hariIni, t.due_date);
    const kelompok: KunciKelompok =
      terlambat <= 0 ? "belum" : terlambat <= 30 ? "h1" : terlambat <= 60 ? "h31" : "h60";
    umur[kelompok] = umur[kelompok].plus(sisa);

    const id = t.customer_id.toString();
    const ada = perPelanggan.get(id);

    if (ada) {
      ada.jumlahTagihan += 1;
      ada.total = ada.total.plus(sisa);
      if (t.due_date < ada.tempoTertua) {
        ada.tempoTertua = t.due_date;
        ada.hariTerlambat = Math.max(0, terlambat);
      }
    } else {
      perPelanggan.set(id, {
        nama: t.customers.name,
        kode: t.customers.customer_code,
        idPelanggan: id,
        jumlahTagihan: 1,
        total: sisa,
        tempoTertua: t.due_date,
        hariTerlambat: Math.max(0, terlambat),
      });
    }
  }

  const daftar = [...perPelanggan.values()].sort((a, b) => b.total.comparedTo(a.total));
  const totalSemua = daftar.reduce((jumlah, p) => jumlah.plus(p.total), d(0));

  return (
    <Halaman>
      <KepalaHalaman
        judul="Kartu piutang"
        keterangan="Sisa tagihan per customer, dikelompokkan menurut umur keterlambatannya."
      />

      <section className="mb-6 grid grid-cols-2 divide-border rounded-lg border bg-card sm:grid-cols-4 sm:divide-x">
        {KELOMPOK.map((k) => (
          <div key={k.kunci} className="px-4 py-4 sm:px-5">
            <p className="eyebrow">{k.label}</p>
            <p
              className={`angka mt-1.5 text-lg font-semibold tracking-[-0.025em] tabular-nums ${
                k.kunci === "h60" && umur.h60.gt(0) ? "text-tempo" : ""
              }`}
            >
              {rupiah(umur[k.kunci])}
            </p>
          </div>
        ))}
      </section>

      <div className="pb-4">
        <Pencarian placeholder="Cari nama customer…" />
      </div>

      <BingkaiTabel>
        {daftar.length === 0 ? (
          <KeadaanKosong
            judul={kunci ? "Tidak ada yang cocok" : "Tidak ada piutang"}
            keterangan={
              kunci
                ? `Tidak ditemukan piutang atas nama "${kunci}".`
                : "Semua tagihan sudah lunas. Tidak ada yang perlu ditagih."
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <Th>Customer</Th>
                <Th className="hidden w-28 sm:table-cell">Tagihan</Th>
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
                      href={`/tagihan?cari=${encodeURIComponent(p.nama)}`}
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
          {daftar.length} pelanggan · total piutang {rupiah(totalSemua)}
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
