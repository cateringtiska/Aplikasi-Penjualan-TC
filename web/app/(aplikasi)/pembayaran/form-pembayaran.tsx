"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { d, rupiah, uraikanRupiah } from "@/lib/uang";

import { tagihanBelumLunas } from "./actions";
import { type KeadaanPembayaran, simpanPembayaran } from "./simpan";

export type PilihanPelanggan = { id: string; nama: string; kode: string };

export type BarisTagihan = {
  id: string;
  nomor: string;
  jatuhTempo: string;
  total: string;
  dibayar: string;
  sisa: string;
  status: string;
  /** Harga makanan + service charge — dasar perhitungan PPh 23. */
  dasarPph: string;
};

const METODE = [
  { nilai: "transfer", label: "Transfer bank" },
  { nilai: "cash", label: "Tunai" },
  { nilai: "giro", label: "Giro" },
  { nilai: "lainnya", label: "Lainnya" },
];

const keadaanAwal: KeadaanPembayaran = {};

export function FormPembayaran({
  id: idPembayaran,
  pelanggan,
  pelangganAwal,
  tagihanAwal,
  tandaiAwal,
  tanggalAwal,
  isiAwal,
}: {
  /** Diisi saat MENGUBAH pembayaran yang sudah ada. */
  id?: string;
  pelanggan: PilihanPelanggan[];
  pelangganAwal: string;
  tagihanAwal: BarisTagihan[];
  /** Id tagihan yang langsung dicentang, saat datang dari halaman tagihan. */
  tandaiAwal?: string;
  tanggalAwal: string;
  /** Isian pembayaran yang sedang diubah. */
  isiAwal?: {
    pph23: string;
    buktiPph: string;
    metode: string;
    bankCash: string;
    catatan: string;
    totalDiterima: string;
    alokasi: Record<string, string>;
  };
}) {
  const [keadaan, kirim, sedangKirim] = useActionState(simpanPembayaran, keadaanAwal);
  const [memuat, mulaiMuat] = useTransition();

  const [idPelanggan, setIdPelanggan] = useState(pelangganAwal);
  const [tagihan, setTagihan] = useState<BarisTagihan[]>(tagihanAwal);
  const [tanggal, setTanggal] = useState(tanggalAwal);
  const [pph23, setPph23] = useState(isiAwal?.pph23 ?? "");
  const [buktiPph, setBuktiPph] = useState(isiAwal?.buktiPph ?? "");
  const [metode, setMetode] = useState(isiAwal?.metode ?? "transfer");
  const [bankCash, setBankCash] = useState(isiAwal?.bankCash ?? "");
  const [catatan, setCatatan] = useState(isiAwal?.catatan ?? "");
  // Saat datang dari halaman tagihan, tagihan itu langsung tercentang sejumlah
  // sisanya dan uang diterima terisi sama besar — kasus yang paling sering
  // terjadi, jadi tidak perlu diketik ulang.
  const tagihanDitandai = tandaiAwal
    ? tagihanAwal.find((t) => t.id === tandaiAwal)
    : undefined;
  const sisaDitandai = tagihanDitandai
    ? Number(tagihanDitandai.sisa).toLocaleString("id-ID")
    : "";

  const [totalDiterima, setTotalDiterima] = useState(isiAwal?.totalDiterima ?? sisaDitandai);

  const [alokasi, setAlokasi] = useState<Record<string, string>>(() => {
    if (isiAwal) return isiAwal.alokasi;
    return tagihanDitandai ? { [tagihanDitandai.id]: sisaDitandai } : {};
  });

  function gantiPelanggan(idBaru: string) {
    setIdPelanggan(idBaru);
    setAlokasi({});
    setTagihan([]);
    if (!idBaru) return;

    mulaiMuat(async () => {
      // Pembayaran yang sedang diubah ikut disebut: alokasinya sendiri harus
      // dikembalikan ke sisa, kalau tidak angkanya terbaca melebihi sisa.
      setTagihan(await tagihanBelumLunas(idBaru, idPembayaran));
    });
  }

  const jumlahAlokasi = useMemo(
    () =>
      Object.values(alokasi).reduce((jumlah, nilai) => jumlah.plus(uraikanRupiah(nilai) ?? 0), d(0)),
    [alokasi],
  );

  const diterima = uraikanRupiah(totalDiterima) ?? d(0);
  const dipotong = uraikanRupiah(pph23) ?? d(0);

  // Yang menutup invoice adalah uang yang masuk DITAMBAH yang dipotong:
  // PPh 23 sudah disetorkan customer ke kas negara atas nama perusahaan.
  const menutup = diterima.plus(dipotong);
  const selisih = menutup.minus(jumlahAlokasi);

  /**
   * 2% dari harga makanan dan service charge, sebanding dengan bagian yang
   * dialokasikan. Pada pelunasan penuh ia tepat 2% dari dasarnya.
   */
  const usulanPph = useMemo(
    () =>
      tagihan.reduce((jumlah, t) => {
        const bagian = uraikanRupiah(alokasi[t.id] ?? "") ?? d(0);
        if (bagian.lte(0)) return jumlah;

        const total = d(t.total);
        if (total.lte(0)) return jumlah;

        return jumlah.plus(d(t.dasarPph).times(bagian).dividedBy(total).times(0.02));
      }, d(0)),
    [tagihan, alokasi],
  );

  const muatan = JSON.stringify({
    id: idPembayaran ?? null,
    customer_id: idPelanggan,
    payment_date: tanggal,
    payment_method: metode,
    bank_cash: bankCash,
    notes: catatan,
    total_amount: totalDiterima,
    pph23_amount: pph23,
    pph23_bukti: buktiPph,
    alokasi: Object.entries(alokasi)
      .filter(([, nilai]) => (uraikanRupiah(nilai) ?? d(0)).gt(0))
      .map(([invoice_id, jumlah]) => ({ invoice_id, jumlah })),
  });

  return (
    <form action={kirim} className="flex flex-col gap-8 pb-28">
      <input type="hidden" name="muatan" value={muatan} />

      {keadaan.pesan ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/25 bg-destructive/5 px-3.5 py-3 text-sm text-destructive"
        >
          {keadaan.pesan}
        </p>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold tracking-[-0.01em]">Setoran masuk</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Bidang label="Customer" nama="customer_id" galat={keadaan.galat?.customer_id} wajib>
            <select
              id="customer_id"
              value={idPelanggan}
              onChange={(e) => gantiPelanggan(e.target.value)}
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <option value="">— Pilih customer —</option>
              {pelanggan.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama} ({p.kode})
                </option>
              ))}
            </select>
          </Bidang>

          <Bidang label="Tanggal terima" nama="payment_date" wajib>
            <Input
              id="payment_date"
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
            />
          </Bidang>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Bidang label="Cara bayar" nama="payment_method" wajib>
            <select
              id="payment_method"
              value={metode}
              onChange={(e) => setMetode(e.target.value)}
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {METODE.map((m) => (
                <option key={m.nilai} value={m.nilai}>
                  {m.label}
                </option>
              ))}
            </select>
          </Bidang>

          <Bidang label="Bank / kas" nama="bank_cash">
            <Input
              id="bank_cash"
              value={bankCash}
              onChange={(e) => setBankCash(e.target.value)}
              placeholder="BCA 123456789"
            />
          </Bidang>

          <Bidang
            label="Uang diterima"
            nama="total_amount"
            galat={keadaan.galat?.total_amount}
            wajib
          >
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                Rp
              </span>
              <Input
                id="total_amount"
                inputMode="numeric"
                value={totalDiterima}
                onChange={(e) => setTotalDiterima(e.target.value)}
                placeholder="0"
                className="angka pl-9 tabular-nums"
              />
            </div>
          </Bidang>
        </div>

        {/* PPh 23. Dipisah dari "uang diterima" karena memang bukan uang yang
            masuk ke rekening — ia ditahan customer lalu disetorkannya ke kas
            negara atas nama perusahaan. Invoicenya tetap lunas. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Bidang
            label="PPh 23 dipotong"
            nama="pph23_amount"
            galat={keadaan.galat?.pph23_amount}
          >
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                  Rp
                </span>
                <Input
                  id="pph23_amount"
                  inputMode="numeric"
                  value={pph23}
                  onChange={(e) => setPph23(e.target.value)}
                  placeholder="0"
                  className="angka pl-9 tabular-nums"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={usulanPph.lte(0)}
                onClick={() => setPph23(usulanPph.toFixed(0))}
              >
                Hitung 2%
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {usulanPph.gt(0)
                ? `2% dari harga makanan dan service charge: ${rupiah(usulanPph)}`
                : "Isi alokasinya dulu untuk menghitung 2% otomatis."}
            </p>
          </Bidang>

          <Bidang label="Nomor bukti potong" nama="pph23_bukti">
            <Input
              id="pph23_bukti"
              value={buktiPph}
              onChange={(e) => setBuktiPph(e.target.value)}
              placeholder="Nomor dari customer"
            />
            <p className="text-xs text-muted-foreground">
              Tanpa bukti potong, potongannya tidak bisa dikreditkan di SPT.
            </p>
          </Bidang>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold tracking-[-0.01em]">Alokasi ke invoice</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Satu setoran boleh menutup beberapa invoice. Jumlah alokasi harus sama persis dengan
            uang yang diterima ditambah PPh 23 yang dipotong.
          </p>
        </div>

        {keadaan.galat?.alokasi ? (
          <p role="alert" className="text-sm text-destructive">
            {keadaan.galat.alokasi}
          </p>
        ) : null}

        <div className="overflow-hidden rounded-lg border bg-card">
          {memuat ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Memuat invoice…
            </p>
          ) : !idPelanggan ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Pilih customer dulu untuk melihat invoice-nya.
            </p>
          ) : tagihan.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Customer ini tidak punya invoice yang belum lunas.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="w-10 px-4 py-2.5" />
                    <Th>Invoice</Th>
                    <Th className="w-36 text-right">Sisa</Th>
                    <Th className="w-44 text-right">Dialokasikan</Th>
                  </tr>
                </thead>
                <tbody>
                  {tagihan.map((t) => {
                    const dicentang = t.id in alokasi;
                    return (
                      <tr key={t.id} className="border-b last:border-0">
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={dicentang}
                            aria-label={`Alokasikan ke ${t.nomor}`}
                            onCheckedChange={(v) =>
                              setAlokasi((lama) => {
                                const baru = { ...lama };
                                if (v === true) {
                                  baru[t.id] = Number(t.sisa).toLocaleString("id-ID");
                                } else {
                                  delete baru[t.id];
                                }
                                return baru;
                              })
                            }
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className="nomor-dokumen">{t.nomor}</span>
                          <span className="block text-xs text-muted-foreground">
                            jatuh tempo {t.jatuhTempo}
                            {t.status === "overdue" ? " · lewat tempo" : ""}
                          </span>
                        </td>
                        <td className="angka px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {rupiah(t.sisa)}
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            inputMode="numeric"
                            disabled={!dicentang}
                            value={alokasi[t.id] ?? ""}
                            onChange={(e) =>
                              setAlokasi((lama) => ({ ...lama, [t.id]: e.target.value }))
                            }
                            aria-label={`Jumlah alokasi untuk ${t.nomor}`}
                            className="angka h-8 text-right tabular-nums"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Bidang label="Catatan" nama="notes">
          <Textarea
            id="notes"
            rows={2}
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Nomor giro, nama pengirim, atau keterangan lain"
          />
        </Bidang>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-3 sm:px-8">
          <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
            <Angka label="Diterima" nilai={rupiah(diterima)} />
            <Angka label="Dialokasikan" nilai={rupiah(jumlahAlokasi)} />
            <Angka
              label="Selisih"
              nilai={rupiah(selisih)}
              tebal
              peringatan={!selisih.isZero()}
            />
          </dl>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" render={<Link href="/pembayaran" />}>
              Batal
            </Button>
            <Button type="submit" disabled={sedangKirim}>
              {sedangKirim ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                  Menyimpan…
                </>
              ) : (
                idPembayaran ? "Simpan perubahan" : "Simpan payment"
              )}
            </Button>
          </div>
        </div>
      </div>
    </form>
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

function Bidang({
  label,
  nama,
  galat,
  wajib,
  children,
}: {
  label: string;
  nama: string;
  galat?: string;
  wajib?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={nama}>
        {label}
        {wajib ? <span className="text-muted-foreground"> *</span> : null}
      </Label>
      {children}
      {galat ? <p className="text-xs text-destructive">{galat}</p> : null}
    </div>
  );
}

function Angka({
  label,
  nilai,
  tebal,
  peringatan,
}: {
  label: string;
  nilai: string;
  tebal?: boolean;
  peringatan?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`angka tabular-nums ${tebal ? "text-base font-semibold" : "text-sm"} ${
          peringatan ? "text-tempo" : ""
        }`}
      >
        {nilai}
      </dd>
    </div>
  );
}
