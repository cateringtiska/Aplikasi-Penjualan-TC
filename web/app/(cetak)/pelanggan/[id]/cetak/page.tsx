import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ambilKartuPiutang } from "@/lib/kartu-piutang";
import { prisma } from "@/lib/prisma";
import { wajibPeran } from "@/lib/rbac";
import { rupiah } from "@/lib/uang";

export const metadata: Metadata = { title: "Kartu Piutang" };
export const dynamic = "force-dynamic";

/**
 * Kartu piutang satu customer, siap dicetak atau dikirim sebagai PDF.
 *
 * Dokumen ini biasanya dipakai ketika catatan Anda dan catatan customer
 * berselisih, jadi yang terpenting bukan keindahannya melainkan bahwa setiap
 * baris bisa ditelusuri: nomor invoice, nomor setoran, tanggal, dan saldo
 * setelah tiap mutasi.
 */
export default async function CetakKartuPiutang({
  params,
}: PageProps<"/pelanggan/[id]/cetak">) {
  await wajibPeran("sales", "finance");

  const { id } = await params;

  const [kartu, perusahaan] = await Promise.all([
    ambilKartuPiutang(id),
    prisma.company_settings.findFirst({
      select: { company_name: true, logo_path: true },
    }),
  ]);

  if (!kartu) notFound();

  const { customer, baris, totalInvoice, totalBayar, sisa } = kartu;

  return (
    <div className="text-[11px] leading-snug text-black">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-[18px] font-bold">KARTU PIUTANG</h1>
          <p className="mt-0.5 text-[#666]">
            Dicetak {format(new Date(), "d MMMM yyyy HH:mm", { locale: localeId })}
          </p>
        </div>
        {perusahaan?.logo_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={perusahaan.logo_path} alt="" className="h-12 w-auto object-contain" />
        ) : (
          <p className="font-bold">{perusahaan?.company_name ?? ""}</p>
        )}
      </div>

      <table className="mt-4 w-full border-collapse">
        <tbody>
          <tr>
            <Sel label="Customer" nilai={`${customer.nama} (${customer.kode})`} />
            <Sel label="Kontak" nilai={customer.pic ?? "–"} />
            <Sel label="Telepon" nilai={customer.telepon ?? "–"} />
          </tr>
          <tr>
            <td className="border border-[#999] px-1.5 py-1.5 align-top" colSpan={3}>
              <span className="block text-[10px] text-[#666]">Alamat</span>
              {customer.alamat ?? "–"}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="bg-[#f0f0f0]">
            <Th>Tanggal</Th>
            <Th>Dokumen</Th>
            <Th>Keterangan</Th>
            <Th kanan>Invoice</Th>
            <Th kanan>Bayar</Th>
            <Th kanan>Saldo</Th>
          </tr>
        </thead>
        <tbody>
          {baris.length === 0 ? (
            <tr>
              <td className="border border-[#999] px-1.5 py-3 text-center" colSpan={6}>
                Belum ada invoice maupun pembayaran untuk customer ini.
              </td>
            </tr>
          ) : (
            baris.map((b) => (
              <tr key={b.kunci}>
                <Td>{format(b.tanggal, "dd/MM/yyyy")}</Td>
                <Td>{b.nomor}</Td>
                <Td>{b.keterangan ?? "–"}</Td>
                <Td kanan>{b.debit.gt(0) ? rupiah(b.debit) : "–"}</Td>
                <Td kanan>{b.kredit.gt(0) ? rupiah(b.kredit) : "–"}</Td>
                <Td kanan>{rupiah(b.saldo)}</Td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="bg-[#f0f0f0] font-bold">
            <td className="border border-[#999] px-1.5 py-1" colSpan={3}>
              SALDO AKHIR
            </td>
            <Td kanan>{rupiah(totalInvoice)}</Td>
            <Td kanan>{rupiah(totalBayar)}</Td>
            <Td kanan>{rupiah(sisa)}</Td>
          </tr>
        </tfoot>
      </table>

      <p className="mt-3 text-[10px] text-[#666]">
        Invoice berstatus dibatalkan tidak ikut dihitung. Satu baris pembayaran mewakili satu
        alokasi setoran ke satu invoice, sehingga setoran yang menutup beberapa invoice muncul
        pada beberapa baris dengan nomor setoran yang sama.
      </p>

      <div className="mt-10 flex justify-between text-[10px]">
        <div>
          <p className="text-[#666]">Hormat kami,</p>
          <div className="mt-12 w-52 border-t border-black" />
          <p className="mt-1">{perusahaan?.company_name ?? ""}</p>
        </div>
        <div>
          <p className="text-[#666]">Disetujui customer,</p>
          <div className="mt-12 w-52 border-t border-black" />
          <p className="mt-1">{customer.nama}</p>
        </div>
      </div>
    </div>
  );
}

function Sel({ label, nilai }: { label: string; nilai: string }) {
  return (
    <td className="w-1/3 border border-[#999] px-1.5 py-1.5 align-top">
      <span className="block text-[10px] text-[#666]">{label}</span>
      <b>{nilai}</b>
    </td>
  );
}

function Th({ children, kanan }: { children: React.ReactNode; kanan?: boolean }) {
  return (
    <th
      className={`border border-[#999] px-1.5 py-1 font-bold ${kanan ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function Td({ children, kanan }: { children: React.ReactNode; kanan?: boolean }) {
  return (
    <td className={`border border-[#999] px-1.5 py-1 ${kanan ? "text-right" : "text-left"}`}>
      {children}
    </td>
  );
}
