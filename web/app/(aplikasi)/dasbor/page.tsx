import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { KartuAngka, PapanAngka } from "@/components/kartu-angka";
import { PemberitahuanAkses } from "@/components/pemberitahuan-akses";
import { StatusPenawaran, StatusTagihan } from "@/components/lencana-status";
import { type BarisPengakuan, cocokSaringPengakuan, pengakuanDokumen } from "@/lib/pengakuan";
import { ringkasTanggalAcara, tanggalAcaraDokumen } from "@/lib/tanggal";
import { prisma } from "@/lib/prisma";
import { bacaIzin } from "@/lib/izin";
import { bolehBuka, halamanAwal } from "@/lib/navigasi";
import { hanyaMiliknya, wajibSesi } from "@/lib/rbac";

import { tandaiJatuhTempo } from "../tagihan/actions";
import { d, rupiah } from "@/lib/uang";

export const metadata: Metadata = { title: "Dashboard" };

// Angka piutang harus selalu menunjukkan keadaan sekarang, bukan hasil
// simpanan beberapa menit lalu.
export const dynamic = "force-dynamic";

export default async function HalamanDasbor({ searchParams }: PageProps<"/dasbor">) {
  const sesi = await wajibSesi();
  const { akses } = await searchParams;
  const ditolak = akses === "ditolak";

  // Halaman ini dulu hanya menuntut sesi, bukan izin. Peran yang menu
  // Dashboard-nya disembunyikan tetap bisa membukanya dengan mengetik
  // alamatnya — dan itu bukan halaman yang sepele: di sinilah piutang dan
  // omzet SELURUH perusahaan ditampilkan.
  const izin = await bacaIzin();
  if (!bolehBuka(sesi.peran, "dasbor", izin)) {
    const tujuan = halamanAwal(sesi.peran, izin);
    // Tidak dilempar kalau halaman awalnya memang dasbor sendiri — itu
    // terjadi ketika tidak ada satu pun halaman yang terbuka untuknya, dan
    // melemparnya ke sini lagi hanya akan berputar tanpa henti.
    if (tujuan !== "/dasbor") redirect(`${tujuan}?akses=ditolak`);
  }

  const sekarang = new Date();
  const awalHariIni = new Date(sekarang);
  awalHariIni.setHours(0, 0, 0, 0);


  // Status "jatuh tempo" hanya berpindah ketika ada yang menyentuhnya —
  // sampai sekarang itu terjadi saat daftar Invoice dibuka. Dashboard adalah
  // halaman PERTAMA yang dilihat orang setelah masuk, jadi tanpa ini, invoice
  // yang lewat tempo semalam masih terhitung nol sampai ada yang kebetulan
  // membuka daftar Invoice. Angka nol yang salah pada kartu "Jatuh tempo"
  // adalah angka yang membuat orang berhenti menagih.
  await tandaiJatuhTempo();

  // Sales hanya melihat angkanya sendiri. Disaring DI KUERI, bukan setelah
  // datanya terambil: kartu-kartu di bawah adalah penjumlahan, dan
  // penjumlahan yang terlanjur menghitung semuanya tidak bisa disembunyikan
  // lagi oleh penyaringan di tampilan.
  const milik = hanyaMiliknya(sesi);

  const [semuaTagihan, penawaranMenunggu, penawaranTerbaru, tagihanTerbaru] =
    await Promise.all([
      // Diambil barisnya, BUKAN dijumlahkan di database. Penjualan diakui
      // ketika acaranya sudah terjadi, dan itu keputusan per dokumen yang
      // tidak bisa dinyatakan sebagai satu penjumlahan SQL.
      prisma.invoices.findMany({
        where: { ...milik, status: { not: "cancelled" } },
        select: {
          grand_total: true,
          paid_amount: true,
          due_date: true,
          // Kolom lamanya ikut diambil: empat belas dari lima belas invoice
          // menyimpan tanggal acaranya HANYA di situ. Lihat catatan di
          // tanggalAcaraDokumen().
          event_date: true,
          event_days: true,
          invoice_event_dates: { select: { event_date: true } },
        },
      }),
      prisma.quotations.count({ where: { ...milik, status: { in: ["draft", "sent"] } } }),
      prisma.quotations.findMany({
        where: milik,
        take: 5,
        orderBy: { id: "desc" },
        select: {
          id: true,
          quotation_number: true,
          quotation_date: true,
          event_date: true,
          event_days: true,
          quotation_event_dates: { select: { event_date: true } },
          grand_total: true,
          status: true,
          customers: { select: { name: true } },
        },
      }),
      prisma.invoices.findMany({
        where: milik,
        take: 5,
        orderBy: { id: "desc" },
        select: {
          id: true,
          invoice_number: true,
          invoice_date: true,
          event_date: true,
          event_days: true,
          invoice_event_dates: { select: { event_date: true } },
          grand_total: true,
          status: true,
          customers: { select: { name: true } },
        },
      }),
    ]);

  const pengakuan = semuaTagihan.map((t) => {
    const tanggalAcara = tanggalAcaraDokumen(t.invoice_event_dates, t.event_date, t.event_days);

    return {
      dueDate: t.due_date,
      hasil: pengakuanDokumen({ grand_total: t.grand_total, paid_amount: t.paid_amount, tanggalAcara }, sekarang),
      acaraTerakhir: tanggalAcara.reduce<Date | null>((a, b) => (a === null || b > a ? b : a), null),
    } satisfies BarisPengakuan;
  });

  // Dihitung dengan penyaring yang SAMA PERSIS dengan yang dipakai daftar
  // invoice saat kartunya diklik. Angka di kartu dan banyaknya baris di
  // daftar itu tidak boleh berbeda. Lihat lib/pengakuan.ts.
  const cocok = (saring: Parameters<typeof cocokSaringPengakuan>[0]) =>
    pengakuan.filter((x) => cocokSaringPengakuan(saring, x, sekarang));

  const totalPiutang = pengakuan.reduce((j, x) => j.plus(x.hasil.piutang), d(0));
  const totalUangMuka = pengakuan.reduce((j, x) => j.plus(x.hasil.uangMuka), d(0));
  const totalDiMuka = pengakuan.reduce((j, x) => j.plus(x.hasil.diterimaDiMuka), d(0));
  const totalProyeksi = pengakuan.reduce((j, x) => j.plus(x.hasil.proyeksi), d(0));

  const jumlahUangMuka = cocok("uang-muka").length;
  const jumlahDiMuka = cocok("diterima-di-muka").length;
  const jumlahProyeksi = cocok("proyeksi").length;

  const jumlahBelumLunas = cocok("piutang").length;

  // "Bulan ini" kini berarti ACARANYA terjadi bulan ini, bukan invoicenya
  // terbit bulan ini. Itulah bulan penjualannya benar-benar diakui.
  const diakuiBulanIni = cocok("diakui-bulan-ini");
  const nilaiBulanIni = diakuiBulanIni.reduce((j, x) => j.plus(x.hasil.diakui), d(0));

  // Jatuh tempo dihitung dari due_date, bukan dari kolom status: kolom status
  // adalah salinan yang perlu disegarkan, tanggalnya adalah sumbernya.
  const jatuhTempo = cocok("jatuh-tempo").length;

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-10">
      <header>
        <h1 className="text-xl font-semibold tracking-[-0.02em]">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {format(sekarang, "EEEE, d MMMM yyyy", { locale: localeId })}
        </p>
      </header>

      <PemberitahuanAkses ditolak={ditolak} />

      {/* Empat angka utama disusun sebagai satu papan, bukan empat kartu
          terpisah — supaya terbaca sebagai satu ringkasan. */}
      <PapanAngka className="mt-7">
        <KartuAngka
          href="/tagihan?pengakuan=piutang"
          label="Piutang berjalan"
          nilai={rupiah(totalPiutang)}
          keterangan={`${jumlahBelumLunas} invoice, acaranya sudah terjadi`}
          warna="kuning"
          menonjol
        />
        <KartuAngka
          href="/tagihan?pengakuan=diakui-bulan-ini"
          label="Penjualan diakui bulan ini"
          nilai={rupiah(nilaiBulanIni)}
          keterangan={`${diakuiBulanIni.length} acara sudah terjadi`}
          warna="hijau"
        />
        <KartuAngka
          href="/tagihan?pengakuan=uang-muka"
          label="Uang muka"
          nilai={rupiah(totalUangMuka)}
          keterangan={`${jumlahUangMuka} invoice dipanjar, belum lunas`}
          warna="toska"
        />
        <KartuAngka
          href="/tagihan?pengakuan=diterima-di-muka"
          label="Diterima di muka"
          nilai={rupiah(totalDiMuka)}
          keterangan={`${jumlahDiMuka} invoice lunas, acaranya belum terjadi`}
          warna="biru"
        />
        <KartuAngka
          href="/tagihan?pengakuan=proyeksi"
          label="Proyeksi penjualan"
          nilai={rupiah(totalProyeksi)}
          keterangan={`${jumlahProyeksi} dokumen · ${penawaranMenunggu} quotation menunggu`}
          warna="ungu"
        />
        <KartuAngka
          href="/tagihan?pengakuan=jatuh-tempo"
          label="Jatuh tempo"
          nilai={String(jatuhTempo)}
          keterangan={jatuhTempo > 0 ? "perlu ditagih" : "tidak ada"}
          warna="merah"
        />
      </PapanAngka>

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
                  acara={ringkasTanggalAcara(
                    tanggalAcaraDokumen(p.quotation_event_dates, p.event_date, p.event_days),
                  )}
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
                  acara={ringkasTanggalAcara(
                    tanggalAcaraDokumen(t.invoice_event_dates, t.event_date, t.event_days),
                  )}
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
  acara,
  nilai,
  lencana,
}: {
  href: string;
  nomor: string;
  nama: string;
  tanggal: Date;
  /** Ringkasan tanggal acaranya, atau null kalau dokumennya tanpa acara. */
  acara: string | null;
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
          <span className="nomor-dokumen mt-0.5 block truncate text-muted-foreground">
            {nomor} · {format(tanggal, "d MMM yyyy", { locale: localeId })}
          </span>
          {/* Tanggal ACARA, bukan tanggal dokumennya. Seluruh kartu di atas
              digolongkan menurut tanggal acara, dan daftar yang hanya
              menyebut tanggal dokumen membuat orang mengira kartunya salah —
              itu yang ditanyakan pemiliknya tentang invoice yang tanggalnya
              2 Oktober tetapi acaranya 3 Oktober. */}
          {acara ? (
            <span className="mt-0.5 block truncate text-[0.6875rem] text-muted-foreground">
              Acara {acara}
            </span>
          ) : null}
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
