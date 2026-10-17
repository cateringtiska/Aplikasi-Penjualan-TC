import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import type { Metadata } from "next";

import { hanyaMiliknya, wajibIzin } from "@/lib/rbac";
import { rupiah } from "@/lib/uang";

import { ambilLaporan, bacaSaring, judulPeriode } from "@/lib/laporan-penjualan";

export const metadata: Metadata = { title: "Laporan Penjualan" };
export const dynamic = "force-dynamic";

export default async function CetakLaporanPenjualan({
  searchParams,
}: PageProps<"/laporan/penjualan/cetak">) {
  const sesi = await wajibIzin("laporan-penjualan");

  const params = await searchParams;
  const saring = bacaSaring(params);
  const { baris, ringkasan } = await ambilLaporan(saring, hanyaMiliknya(sesi));

  return (
    <div className="text-[11px] leading-snug text-black">
      <h1 className="text-[18px] font-bold">Laporan Penjualan</h1>
      <p className="mt-0.5 text-[#666]">
        Periode: {judulPeriode(saring)} · dicetak{" "}
        {format(new Date(), "d MMMM yyyy HH:mm", { locale: localeId })}
      </p>

      {/* Nilai invoice MEMUAT penjualan yang belum diakui, dan itu pernah
          ditanyakan: kartu Dashboard menyebut "penjualan diakui" yang lebih
          kecil, dan tanpa rinciannya kedua angka terbaca seolah
          bertentangan. Ketiga baris di bawahnya menjumlah tepat ke nilai
          invoice, jadi selisihnya bisa ditelusuri sendiri. */}
      <table className="mt-4 w-full border-collapse">
        <tbody>
          <tr>
            <Ringkas label="Nilai invoice" nilai={rupiah(ringkasan.nilaiTagihan)} />
            <Ringkas label="Sudah dibayar" nilai={rupiah(ringkasan.totalTerbayar)} />
            <Ringkas label="Piutang" nilai={rupiah(ringkasan.totalPiutang)} />
            <Ringkas label="Jatuh tempo" nilai={`${ringkasan.jumlahJatuhTempo} tagihan`} />
          </tr>
        </tbody>
      </table>

      <table className="mt-2 w-full border-collapse">
        <tbody>
          <tr>
            <Ringkas
              label="Penjualan diakui — acaranya sudah terjadi"
              nilai={rupiah(ringkasan.penjualanDiakui)}
            />
            <Ringkas
              label="Diterima di muka — lunas, acaranya belum"
              nilai={rupiah(ringkasan.diterimaDiMuka)}
            />
            <Ringkas
              label="Proyeksi — acaranya belum terjadi"
              nilai={rupiah(ringkasan.proyeksiPenjualan)}
            />
            <Ringkas
              label="Uang muka sudah masuk"
              nilai={rupiah(ringkasan.uangMuka)}
            />
          </tr>
        </tbody>
      </table>

      <p className="mt-1.5 text-[10px] text-[#666]">
        Nilai invoice = penjualan diakui + diterima di muka + proyeksi. Yang diakui sebagai
        penjualan hanya baris pertama; dua sisanya belum, karena acaranya belum terjadi.
        Piutang pun hanya dihitung dari penjualan yang sudah diakui, jadi ia tidak sama
        dengan nilai invoice dikurangi yang sudah dibayar.
      </p>

      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="bg-[#f0f0f0]">
            <Th>No. Invoice</Th>
            <Th>Tanggal</Th>
            <Th>Customer</Th>
            <Th>Jatuh Tempo</Th>
            <Th kanan>Total</Th>
            <Th kanan>Terbayar</Th>
            <Th kanan>Sisa</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {baris.length === 0 ? (
            <tr>
              <td className="border border-[#999] px-1.5 py-3 text-center" colSpan={8}>
                Tidak ada invoice pada rentang ini.
              </td>
            </tr>
          ) : (
            baris.map((b) => (
              <tr key={b.id} className="break-inside-avoid">
                <Td>{b.nomor}</Td>
                <Td>{format(b.tanggal, "dd/MM/yyyy")}</Td>
                <Td>{b.pelanggan}</Td>
                <Td>{format(b.jatuhTempo, "dd/MM/yyyy")}</Td>
                <Td kanan>{rupiah(b.total)}</Td>
                <Td kanan>{rupiah(b.dibayar)}</Td>
                <Td kanan>{b.status === "cancelled" ? "—" : rupiah(b.sisa)}</Td>
                <Td>{b.statusLabel}</Td>
              </tr>
            ))
          )}

          {baris.length > 0 ? (
            <tr className="bg-[#f9f9f9] font-bold">
              <td className="border border-[#999] px-1.5 py-1" colSpan={4}>
                TOTAL ({ringkasan.jumlahTagihan} tagihan aktif)
              </td>
              <td className="border border-[#999] px-1.5 py-1 text-right">
                {rupiah(ringkasan.nilaiTagihan)}
              </td>
              <td className="border border-[#999] px-1.5 py-1 text-right">
                {rupiah(ringkasan.totalTerbayar)}
              </td>
              <td className="border border-[#999] px-1.5 py-1 text-right">
                {rupiah(ringkasan.totalPiutang)}
              </td>
              <td className="border border-[#999] px-1.5 py-1" />
            </tr>
          ) : null}
        </tbody>
      </table>

      <p className="mt-3 text-[10px] text-[#666]">
        Invoice berstatus dibatalkan tidak dihitung dalam ringkasan.
      </p>
    </div>
  );
}

function Ringkas({ label, nilai }: { label: string; nilai: string }) {
  return (
    <td className="w-1/4 border border-[#999] px-1.5 py-1.5 align-top">
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
