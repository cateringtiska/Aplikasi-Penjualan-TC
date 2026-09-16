import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import type { Metadata } from "next";
import Link from "next/link";

import { StatusPenawaran, StatusTagihan } from "@/components/lencana-status";
import { prisma } from "@/lib/prisma";

import { tandaiJatuhTempo } from "../tagihan/actions";
import { d, rupiah } from "@/lib/uang";

export const metadata: Metadata = { title: "Dashboard" };

// Angka piutang harus selalu menunjukkan keadaan sekarang, bukan hasil
// simpanan beberapa menit lalu.
export const dynamic = "force-dynamic";

const BELUM_LUNAS = ["unpaid", "partial", "overdue"];

export default async function HalamanDasbor({ searchParams }: PageProps<"/dasbor">) {
  const { akses } = await searchParams;
  const ditolak = akses === "ditolak";

  const sekarang = new Date();
  const awalHariIni = new Date(sekarang);
  awalHariIni.setHours(0, 0, 0, 0);

  const awalBulan = new Date(sekarang.getFullYear(), sekarang.getMonth(), 1);
  const awalBulanDepan = new Date(sekarang.getFullYear(), sekarang.getMonth() + 1, 1);

  // Status "jatuh tempo" hanya berpindah ketika ada yang menyentuhnya —
  // sampai sekarang itu terjadi saat daftar Invoice dibuka. Dashboard adalah
  // halaman PERTAMA yang dilihat orang setelah masuk, jadi tanpa ini, invoice
  // yang lewat tempo semalam masih terhitung nol sampai ada yang kebetulan
  // membuka daftar Invoice. Angka nol yang salah pada kartu "Jatuh tempo"
  // adalah angka yang membuat orang berhenti menagih.
  await tandaiJatuhTempo();

  const [piutang, bulanIni, penawaranMenunggu, jatuhTempo, penawaranTerbaru, tagihanTerbaru] =
    await Promise.all([
      // Sisa piutang = jumlah grand total dikurangi jumlah yang sudah dibayar.
      // Keduanya penjumlahan biasa, jadi boleh dihitung terpisah lalu dikurangi.
      prisma.invoices.aggregate({
        where: { status: { in: BELUM_LUNAS } },
        _sum: { grand_total: true, paid_amount: true },
        _count: true,
      }),
      prisma.invoices.aggregate({
        where: {
          invoice_date: { gte: awalBulan, lt: awalBulanDepan },
          status: { not: "cancelled" },
        },
        _sum: { grand_total: true },
        _count: true,
      }),
      prisma.quotations.count({ where: { status: { in: ["draft", "sent"] } } }),
      // Dihitung dari due_date, bukan dari kolom status. Kolom status adalah
      // salinan yang perlu disegarkan; tanggal jatuh tempo adalah sumbernya.
      // Kalau panggilan penyegaran di atas suatu saat hilang, angka ini tetap
      // benar.
      prisma.invoices.count({
        where: { status: { in: BELUM_LUNAS }, due_date: { lt: awalHariIni } },
      }),
      prisma.quotations.findMany({
        take: 5,
        orderBy: { id: "desc" },
        select: {
          id: true,
          quotation_number: true,
          quotation_date: true,
          grand_total: true,
          status: true,
          customers: { select: { name: true } },
        },
      }),
      prisma.invoices.findMany({
        take: 5,
        orderBy: { id: "desc" },
        select: {
          id: true,
          invoice_number: true,
          invoice_date: true,
          grand_total: true,
          status: true,
          customers: { select: { name: true } },
        },
      }),
    ]);

  const totalPiutang = d(piutang._sum.grand_total).minus(d(piutang._sum.paid_amount));

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-10">
      <header>
        <h1 className="text-xl font-semibold tracking-[-0.02em]">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {format(sekarang, "EEEE, d MMMM yyyy", { locale: localeId })}
        </p>
      </header>

      {/* wajibPeran melempar ke sini dengan ?akses=ditolak. Tanpa
          pemberitahuan ini, orang yang membuka halaman terlarang hanya
          mendapati dirinya tiba-tiba di Dashboard — yang terbaca sebagai
          tautan rusak, bukan sebagai penolakan yang memang disengaja. */}
      {ditolak ? (
        <p
          role="alert"
          className="mt-6 rounded-md border border-border-strong/60 bg-muted/50 px-3.5 py-3 text-sm"
        >
          Halaman yang Anda buka hanya untuk peran tertentu, jadi Anda dikembalikan ke
          Dashboard. Ini bukan kesalahan — menu yang tidak terlihat memang sengaja ditutup
          untuk peran Anda.
        </p>
      ) : null}

      {/* Empat angka utama disusun sebagai satu papan, bukan empat kartu
          terpisah — supaya terbaca sebagai satu ringkasan. */}
      <section className="mt-7 grid grid-cols-2 divide-border rounded-lg border bg-card sm:grid-cols-4 sm:divide-x">
        <Angka
          label="Piutang berjalan"
          nilai={rupiah(totalPiutang)}
          keterangan={`${piutang._count} invoice belum lunas`}
          menonjol
        />
        <Angka
          label="Penjualan bulan ini"
          nilai={rupiah(bulanIni._sum.grand_total)}
          keterangan={`${bulanIni._count} invoice terbit`}
        />
        <Angka
          label="Quotation menunggu"
          nilai={String(penawaranMenunggu)}
          keterangan="draft atau terkirim"
        />
        <Angka
          label="Jatuh tempo"
          nilai={String(jatuhTempo)}
          keterangan={jatuhTempo > 0 ? "perlu ditagih" : "tidak ada"}
          peringatan={jatuhTempo > 0}
        />
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <Panel judul="Quotation terbaru" href="/penawaran">
          {penawaranTerbaru.length === 0 ? (
            <Kosong pesan="Belum ada quotation." />
          ) : (
            <ul className="divide-y">
              {penawaranTerbaru.map((p) => (
                <Baris
                  key={p.id.toString()}
                  href={`/penawaran/${p.id}`}
                  nomor={p.quotation_number}
                  nama={p.customers.name}
                  tanggal={p.quotation_date}
                  nilai={p.grand_total}
                  lencana={<StatusPenawaran status={p.status} />}
                />
              ))}
            </ul>
          )}
        </Panel>

        <Panel judul="Invoice terbaru" href="/tagihan">
          {tagihanTerbaru.length === 0 ? (
            <Kosong pesan="Belum ada invoice." />
          ) : (
            <ul className="divide-y">
              {tagihanTerbaru.map((t) => (
                <Baris
                  key={t.id.toString()}
                  href={`/tagihan/${t.id}`}
                  nomor={t.invoice_number}
                  nama={t.customers.name}
                  tanggal={t.invoice_date}
                  nilai={t.grand_total}
                  lencana={<StatusTagihan status={t.status} />}
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Angka({
  label,
  nilai,
  keterangan,
  menonjol,
  peringatan,
}: {
  label: string;
  nilai: string;
  keterangan: string;
  menonjol?: boolean;
  peringatan?: boolean;
}) {
  return (
    <div className="px-4 py-4 sm:px-5">
      <p className="eyebrow">{label}</p>
      <p
        className={`angka mt-1.5 font-semibold tracking-[-0.025em] tabular-nums ${
          menonjol ? "text-[1.375rem]" : "text-lg"
        } ${peringatan ? "text-tempo" : ""}`}
      >
        {nilai}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{keterangan}</p>
    </div>
  );
}

function Panel({
  judul,
  href,
  children,
}: {
  judul: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between pb-2.5">
        <h2 className="text-sm font-semibold tracking-[-0.01em]">{judul}</h2>
        <Link
          href={href}
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Lihat semua
        </Link>
      </div>
      <div className="overflow-hidden rounded-lg border bg-card">{children}</div>
    </section>
  );
}

function Baris({
  href,
  nomor,
  nama,
  tanggal,
  nilai,
  lencana,
}: {
  href: string;
  nomor: string;
  nama: string;
  tanggal: Date;
  nilai: unknown;
  lencana: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/45"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.8125rem] font-medium">{nama}</span>
          <span className="nomor-dokumen mt-0.5 block text-muted-foreground">
            {nomor} · {format(tanggal, "d MMM yyyy", { locale: localeId })}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="angka text-[0.8125rem] font-medium tabular-nums">
            {rupiah(nilai as never)}
          </span>
          {lencana}
        </span>
      </Link>
    </li>
  );
}

function Kosong({ pesan }: { pesan: string }) {
  return <p className="px-4 py-10 text-center text-sm text-muted-foreground">{pesan}</p>;
}
