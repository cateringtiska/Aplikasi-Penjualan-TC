import { Fragment } from "react";

import { format } from "date-fns";

import { romawi, rupiah } from "@/lib/uang";

/* ==========================================================================
   DOKUMEN CETAK

   Satu tata letak dipakai penawaran maupun tagihan, karena keduanya memang
   dokumen yang sama bentuknya di mata pelanggan — hanya judul, nomor, dan
   beberapa baris kepala yang berbeda.

   Ditata mengikuti dokumen yang sudah dipakai perusahaan: kepala tiga kolom,
   bilah judul, tabel acara, tabel rincian dengan penomoran Romawi, lalu blok
   rekening dan tanda tangan.
   ========================================================================== */

export type BarisCetak = {
  id: string;
  item_name: string;
  unit: string | null;
  qty: string;
  price: string;
  subtotal: string;
  is_compliment: boolean;
  anak: {
    id: string;
    item_name: string;
    unit: string | null;
    qty: string;
    price: string;
    subtotal: string;
  }[];
};

export type Perusahaan = {
  company_name: string;
  logo_path: string | null;
  signature_path: string | null;
  signature_name: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_holder: string | null;
};

export type IsiDokumen = {
  judul: string;
  labelNomor: string;
  nomor: string;
  tanggal: Date;
  labelTanggalKedua: string;
  tanggalKedua: Date;

  pelanggan: { nama: string; alamat: string | null };
  kontak: { nama: string | null; telepon: string | null };

  acara: {
    tanggal: Date | null;
    hari: number | null;
    tamu: number | null;
    planner: string | null;
    jam: string | null;
    venue: string | null;
    jenis: string | null;
  };

  baris: BarisCetak[];

  subtotal: string;
  service_charge_percent: string | null;
  service_charge_amount: string;
  pb1_enabled: boolean;
  pb1_percent: string | null;
  pb1_amount: string;
  delivery_amount: string;
  grand_total: string;

  catatan: string | null;
  syarat: string | null;

  perusahaan: Perusahaan;
};

/** Membuang nol di belakang koma: 5.00 -> 5, 7.50 -> 7,5 */
function persen(nilai: string | null): string {
  if (!nilai) return "0";
  return Number(nilai)
    .toString()
    .replace(".", ",");
}

/**
 * Gambar hanya ditampilkan kalau alamatnya berupa tautan penuh.
 *
 * Berkas lama Laravel tersimpan sebagai jalur relatif di disk server itu,
 * yang tidak bisa dijangkau dari sini. Unggahan baru lewat halaman
 * Pengaturan menyimpan tautan penuh, dan itu yang akan tampil.
 */
function tautanGambar(jalur: string | null): string | null {
  if (!jalur) return null;
  return jalur.startsWith("http") ? jalur : null;
}

export function DokumenCetak({ isi }: { isi: IsiDokumen }) {
  const logo = tautanGambar(isi.perusahaan.logo_path);
  const ttd = tautanGambar(isi.perusahaan.signature_path);
  const adaAcara = Boolean(isi.acara.tanggal || isi.acara.venue || isi.acara.tamu);

  return (
    <div className="text-[11px] leading-snug text-black">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt={isi.perusahaan.company_name} className="mb-2.5 h-[50px] w-auto" />
      ) : (
        <p className="mb-2.5 text-sm font-bold">{isi.perusahaan.company_name}</p>
      )}

      {/* Kepala tiga kolom */}
      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <TdKepala lebar="50%">
              <b>Account Name:</b> {isi.pelanggan.nama}
            </TdKepala>
            <TdKepala lebar="25%">
              <b>UP - Kepada:</b> {isi.kontak.nama || "-"}
            </TdKepala>
            <TdKepala lebar="25%">
              <b>{isi.labelNomor}:</b> {isi.nomor}
            </TdKepala>
          </tr>
          <tr>
            <TdKepala>
              <b>Alamat:</b> {isi.pelanggan.alamat || "-"}
            </TdKepala>
            <TdKepala>
              <b>Phone:</b> {isi.kontak.telepon || "-"}
            </TdKepala>
            <TdKepala>
              <b>Tanggal:</b> {format(isi.tanggal, "dd/MM/yyyy")}
            </TdKepala>
          </tr>
          <tr>
            <TdKepala />
            <TdKepala />
            <TdKepala>
              <b>{isi.labelTanggalKedua}:</b> {format(isi.tanggalKedua, "dd/MM/yyyy")}
            </TdKepala>
          </tr>
        </tbody>
      </table>

      <div className="my-2.5 bg-[#dddddd] px-2 py-2 text-center text-[18px] font-bold uppercase">
        {isi.judul}
        {isi.acara.jenis ? ` - ${isi.acara.jenis}` : ""}
      </div>

      {adaAcara ? (
        <table className="mb-2.5 w-full border-collapse">
          <tbody>
            <tr>
              <TdKepala>
                <b>Tanggal Acara:</b>{" "}
                {isi.acara.tanggal ? format(isi.acara.tanggal, "dd/MM/yyyy") : "-"}
              </TdKepala>
              <TdKepala>
                <b>Jumlah Hari:</b> {isi.acara.hari ?? "-"}
              </TdKepala>
              <TdKepala>
                <b>Jumlah Tamu:</b> {isi.acara.tamu ?? "-"}
              </TdKepala>
            </tr>
            <tr>
              <TdKepala>
                <b>F&amp;B Planner:</b> {isi.acara.planner || "-"}
              </TdKepala>
              <TdKepala>
                <b>Jam:</b> {isi.acara.jam || "-"}
              </TdKepala>
              <TdKepala>
                <b>Lokasi:</b> {isi.acara.venue || "-"}
              </TdKepala>
            </tr>
          </tbody>
        </table>
      ) : null}

      {/* Rincian */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[#f0f0f0]">
            <Th lebar="5%">No</Th>
            <Th>Deskripsi</Th>
            <Th lebar="8%">Qty</Th>
            <Th lebar="10%">Satuan</Th>
            <Th lebar="15%" kanan>
              Harga
            </Th>
            <Th lebar="15%" kanan>
              Subtotal
            </Th>
          </tr>
        </thead>
        <tbody>
          {isi.baris.map((b, i) => {
            // Sub-item berharga mendapat barisnya sendiri, bernomor V.1, V.2;
            // yang tak berharga tetap menumpang di kolom deskripsi induknya
            // sebagai rincian isi paket. Keduanya dipakai di dokumen katering:
            // "ANEKA STALL" adalah judul kelompok yang anaknya berharga,
            // sedangkan "LUNCH BOX" adalah paket berharga yang anaknya hanya
            // menyebutkan isinya.
            const anakBerharga = b.anak.filter((a) => Number(a.subtotal) > 0);
            const anakRincian = b.anak.filter((a) => Number(a.subtotal) <= 0);
            // Induk yang punya sub-item berharga adalah JUDUL, apa pun isi
            // kolom angkanya. Menampilkan "1" dan "Rp 0" di baris judul
            // membuat pembacanya mencari-cari apa yang berharga nol.
            const indukBernilai = anakBerharga.length === 0;

            return (
              <Fragment key={b.id}>
                <tr className="break-inside-avoid">
                  <Td>{romawi(i + 1)}</Td>
                  <Td>
                    <span className={anakBerharga.length > 0 ? "font-bold" : ""}>
                      {b.item_name}
                    </span>
                    {anakRincian.length > 0 ? (
                      <div className="mt-0.5">
                        {anakRincian.map((a) => (
                          <div key={a.id} className="ml-3 text-[10px] text-[#666]">
                            - {a.item_name}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </Td>
                  {/* Judul kelompok dibiarkan kosong, bukan diisi angka nol —
                      nol terbaca sebagai harga, kosong terbaca sebagai judul. */}
                  <Td>{indukBernilai ? Number(b.qty).toLocaleString("id-ID") : ""}</Td>
                  <Td>{indukBernilai ? (b.unit ?? "") : ""}</Td>
                  <Td kanan>
                    {b.is_compliment ? "Compliment" : indukBernilai ? rupiah(b.price) : ""}
                  </Td>
                  <Td kanan>
                    {b.is_compliment ? "Compliment" : indukBernilai ? rupiah(b.subtotal) : ""}
                  </Td>
                </tr>

                {anakBerharga.map((a, j) => (
                  <tr key={a.id} className="break-inside-avoid">
                    <Td>{`${romawi(i + 1)}.${j + 1}`}</Td>
                    <Td>
                      <span className="ml-3">{a.item_name}</span>
                    </Td>
                    <Td>{Number(a.qty).toLocaleString("id-ID")}</Td>
                    <Td>{a.unit ?? ""}</Td>
                    <Td kanan>{b.is_compliment ? "Compliment" : rupiah(a.price)}</Td>
                    <Td kanan>{b.is_compliment ? "Compliment" : rupiah(a.subtotal)}</Td>
                  </tr>
                ))}
              </Fragment>
            );
          })}

          <TrTotal label="Sub Total" nilai={rupiah(isi.subtotal)} />
          {Number(isi.service_charge_amount) > 0 ? (
            <TrTotal
              label={`Service Charge (${persen(isi.service_charge_percent)}%)`}
              nilai={rupiah(isi.service_charge_amount)}
            />
          ) : null}
          {isi.pb1_enabled && Number(isi.pb1_amount) > 0 ? (
            <TrTotal label={`PB1 (${persen(isi.pb1_percent)}%)`} nilai={rupiah(isi.pb1_amount)} />
          ) : null}
          {/* Delivery ditaruh SESUDAH kedua pungutan, supaya pembaca dokumen
              bisa menelusuri perhitungannya dari atas ke bawah dan melihat
              sendiri bahwa ongkos kirim ini tidak ikut dipajaki. */}
          {Number(isi.delivery_amount) > 0 ? (
            <TrTotal label="Delivery" nilai={rupiah(isi.delivery_amount)} />
          ) : null}
          <TrTotal label="TOTAL" nilai={rupiah(isi.grand_total)} />
        </tbody>
      </table>

      {isi.catatan ? (
        <p className="mt-2.5">
          <b>Catatan:</b> {isi.catatan}
        </p>
      ) : null}

      {isi.syarat ? (
        <div className="mt-3.5 border border-[#999] p-2 text-[10px]">
          <div className="mb-1 font-bold">Syarat &amp; Ketentuan / Termin Pembayaran:</div>
          <div className="whitespace-pre-line">{isi.syarat}</div>
        </div>
      ) : null}

      {isi.perusahaan.bank_name ? (
        <div className="mt-3.5 text-center text-[10px]">
          Pembayaran via transfer ke Rekening: <b>{isi.perusahaan.bank_name}</b>
          <br />
          Nomor Rekening: <b>{isi.perusahaan.bank_account_number}</b> a.n.{" "}
          <b>{isi.perusahaan.bank_account_holder}</b>
        </div>
      ) : null}

      {/* Tanda tangan */}
      <table className="mt-8 w-full break-inside-avoid border-collapse">
        <tbody>
          <tr>
            <td className="w-1/2 px-2.5 align-top">
              Hormat Kami,
              <br />
              <br />
              {ttd ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ttd} alt="" className="my-1 h-[50px] w-auto" />
              ) : (
                <div className="h-[60px]" />
              )}
              <b>{isi.perusahaan.signature_name || isi.perusahaan.company_name}</b>
              <br />
              {isi.perusahaan.company_name}
            </td>
            <td className="w-1/2 px-2.5 align-top">
              Persetujuan Klien,
              <br />
              <br />
              <div className="h-[60px]" />
              <div className="mt-10 w-[200px] border-t border-[#333]" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function TdKepala({
  children,
  lebar,
}: {
  children?: React.ReactNode;
  lebar?: string;
}) {
  return (
    <td className="border border-[#999] px-1.5 py-1 align-top" style={{ width: lebar }}>
      {children}
    </td>
  );
}

function Th({
  children,
  lebar,
  kanan,
}: {
  children: React.ReactNode;
  lebar?: string;
  kanan?: boolean;
}) {
  return (
    <th
      className={`border border-[#999] px-1.5 py-1 align-top font-bold ${kanan ? "text-right" : "text-left"}`}
      style={{ width: lebar }}
    >
      {children}
    </th>
  );
}

function Td({ children, kanan }: { children?: React.ReactNode; kanan?: boolean }) {
  return (
    <td
      className={`border border-[#999] px-1.5 py-1 align-top ${kanan ? "text-right" : "text-left"}`}
    >
      {children}
    </td>
  );
}

function TrTotal({ label, nilai }: { label: string; nilai: string }) {
  return (
    <tr className="break-inside-avoid bg-[#f9f9f9] font-bold">
      <td className="border border-[#999] px-1.5 py-1" colSpan={5}>
        {label}
      </td>
      <td className="border border-[#999] px-1.5 py-1 text-right">{nilai}</td>
    </tr>
  );
}
