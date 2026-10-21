import { format } from "date-fns";

import { barisTabelDokumen, type ItemCetak } from "@/lib/baris-cetak";
import { jumlahHariAcara, ringkasTanggalAcara } from "@/lib/tanggal";

/* ==========================================================================
   PO TO KITCHEN

   Lembar kerja untuk dapur dan pengantaran: apa yang dimasak, berapa
   banyak, untuk siapa, kapan, dan diantar ke mana.

   TIDAK ADA SATU PUN ANGKA UANG DI SINI, dan itu bukan sekadar supaya
   lembarnya ringkas. Lembar ini beredar di dapur, ikut dibawa pengantar,
   dan tidak jarang tertinggal di tempat acara — di tangan tamu, pengelola
   gedung, atau vendor lain. Harga jual yang ikut terbaca di situ adalah
   kebocoran yang tidak bisa ditarik kembali.

   Daftar menunya disusun oleh lib/baris-cetak.ts, modul yang sama yang
   dipakai dokumen untuk customer. Dengan begitu dapur dan customer tidak
   pernah memegang daftar item yang berbeda — hanya kolom harganya yang
   tidak ikut digambar di sini.
   ========================================================================== */

/**
 * Nama yang dipakai lembar dapur.
 *
 * SENGAJA BERBEDA dari nama di pengaturan perusahaan. Yang tercetak di
 * quotation dan invoice adalah nama badan hukumnya, karena dokumen itu
 * dasar penagihan. Lembar ini tidak pernah keluar sebagai tagihan; yang
 * dikenali dapur dan pengantar adalah nama dagangnya.
 *
 * Ditulis di sini, bukan diambil dari pengaturan perusahaan, justru supaya
 * mengubah nama di sana TIDAK ikut mengubah yang ini — dan sebaliknya.
 */
const NAMA_DAPUR = "Tiska Catering";

/**
 * Navy blue untuk NAMA MENU-nya.
 *
 * Lembar ini dibaca sambil memasak — berdiri, tergesa, kertasnya sering
 * kena uap dan noda. Warnanya dipakai untuk menandai di mana satu menu
 * mulai, supaya mata bisa melompat dari menu ke menu tanpa membaca
 * seluruh isinya; isi paket di bawahnya hitam biasa, sebab itu yang
 * dibaca baris demi baris saat memasaknya.
 */
const NAVY = "#000080";

export type IsiDapur = {
  nomor: string;
  labelNomor: string;
  revisi?: number;

  pemesan: string;
  alamat: string | null;
  kontak: { nama: string | null; telepon: string | null };

  acara: {
    tanggal: Date[];
    jenis: string | null;
    jam: string | null;
    venue: string | null;
    tamu: number | null;
  };

  baris: ItemCetak[];
  catatan: string | null;
};

export function DokumenDapur({ isi }: { isi: IsiDapur }) {
  const tanggalAcara = ringkasTanggalAcara(isi.acara.tanggal);
  const hariAcara = jumlahHariAcara(isi.acara.tanggal);

  return (
    <div className="text-[12px] leading-[1.5] text-black">
      <div className="mb-3 flex items-end justify-between gap-4 border-b-2 border-black pb-2">
        <div>
          <div className="text-[18px] font-bold tracking-wide">PO TO KITCHEN</div>
          <div className="text-[11px] text-[#555]">{NAMA_DAPUR}</div>
        </div>
        <div className="text-right text-[11px]">
          <div>
            <b>{isi.labelNomor}:</b> {isi.nomor}
            {isi.revisi && isi.revisi > 0 ? (
              <span className="font-bold"> (Revisi {isi.revisi})</span>
            ) : null}
          </div>
          <div className="text-[#555]">Dicetak {format(new Date(), "dd/MM/yyyy HH:mm")}</div>
        </div>
      </div>

      {/* Keterangan acara. Ditulis besar dan berjarak, sebab lembar ini
          dibaca sambil berdiri dan sambil mengerjakan hal lain. */}
      <table className="mb-3 w-full border-collapse">
        <tbody>
          <Baris label="Pemesan" nilai={isi.pemesan} tebal />
          <Baris label="Alamat" nilai={isi.alamat || "-"} />
          <Baris
            label="Tanggal Acara"
            nilai={tanggalAcara ?? "-"}
            tebal
            sampingLabel="Day"
            samping={hariAcara > 0 ? `${hariAcara} hari` : "-"}
          />
          <Baris label="Nama Acara" nilai={isi.acara.jenis || "-"} />
          <Baris
            label="Jam Pengiriman"
            nilai={isi.acara.jam || "-"}
            tebal
            sampingLabel="Jumlah Tamu"
            samping={isi.acara.tamu ? `${isi.acara.tamu} orang` : "-"}
          />
          {/* Lokasi dan kontak tidak diminta, tetapi lembar yang dibawa
              pengantar tanpa keduanya memaksa orangnya menelepon kantor
              untuk menanyakan ke mana dan kepada siapa. */}
          <Baris label="Lokasi" nilai={isi.acara.venue || "-"} />
          <Baris
            label="Kontak"
            nilai={
              [isi.kontak.nama, isi.kontak.telepon].filter(Boolean).join(" · ") || "-"
            }
          />
        </tbody>
      </table>

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[#eee]">
            <Th lebar="6%">No</Th>
            <Th>Menu</Th>
            <Th lebar="8%" tengah>
              Day
            </Th>
            <Th lebar="9%" tengah>
              Qty
            </Th>
            <Th lebar="9%" tengah>
              Pax
            </Th>
            <Th lebar="13%" tengah>
              Vol.
            </Th>
          </tr>
        </thead>
        <tbody>
          {barisTabelDokumen(isi.baris).map((b) =>
            // Total kelompok adalah angka uang. Dibuang di sini, bukan
            // digambar kosong: baris total tanpa angkanya hanya menimbulkan
            // pertanyaan di dapur.
            b.jenis === "totalKelompok" ? null : (
              <tr key={b.kunci} className="break-inside-avoid">
                <Td tengah>{b.nomor}</Td>
                <Td>
                  {b.menjorok ? (
                    <span className="ml-4">{b.nama}</span>
                  ) : (
                    <span className="font-bold" style={{ color: NAVY }}>
                      {b.nama}
                    </span>
                  )}
                  {b.rincian.length > 0 ? (
                    <div className="mt-0.5">
                      {/* Jumlah dan pax-nya ikut ditulis. Sebagian isi
                          paket punya jumlah sungguhan — tiga ratus porsi
                          Indomie di stall tambahan — dan tanpa angka itu
                          lembarnya tidak bisa dipakai memasak. */}
                      {b.rincian.map((r) => (
                        <div key={r.nama} className="ml-4 text-[12px]">
                          - {r.nama}
                          {r.keterangan ? <b className="ml-1">{r.keterangan}</b> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </Td>
                <Td tengah>{b.hari}</Td>
                <Td tengah tebal>
                  {b.qty}
                </Td>
                <Td tengah tebal>
                  {b.pax}
                </Td>
                <Td tengah>{b.satuan}</Td>
              </tr>
            ),
          )}
        </tbody>
      </table>

      {isi.catatan ? (
        <div className="mt-3 border border-black p-2">
          <div className="font-bold">Catatan:</div>
          <div className="whitespace-pre-line">{isi.catatan}</div>
        </div>
      ) : null}

      <table className="mt-10 w-full break-inside-avoid border-collapse">
        <tbody>
          <tr>
            <td className="w-1/3 px-2 align-top text-center">
              Dibuat,
              <div className="h-[55px]" />
              <div className="mx-auto w-[150px] border-t border-black" />
            </td>
            <td className="w-1/3 px-2 align-top text-center">
              Dapur,
              <div className="h-[55px]" />
              <div className="mx-auto w-[150px] border-t border-black" />
            </td>
            <td className="w-1/3 px-2 align-top text-center">
              Diterima,
              <div className="h-[55px]" />
              <div className="mx-auto w-[150px] border-t border-black" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Baris({
  label,
  nilai,
  tebal,
  sampingLabel,
  samping,
}: {
  label: string;
  nilai: string;
  tebal?: boolean;
  sampingLabel?: string;
  samping?: string;
}) {
  return (
    <tr>
      <td className="w-[22%] border border-[#999] px-2 py-1 align-top text-[#555]">{label}</td>
      <td
        className={`border border-[#999] px-2 py-1 align-top ${tebal ? "font-bold" : ""}`}
        colSpan={sampingLabel ? 1 : 3}
      >
        {nilai}
      </td>
      {sampingLabel ? (
        <>
          <td className="w-[16%] border border-[#999] px-2 py-1 align-top text-[#555]">
            {sampingLabel}
          </td>
          <td className="w-[18%] border border-[#999] px-2 py-1 align-top font-bold">
            {samping}
          </td>
        </>
      ) : null}
    </tr>
  );
}

function Th({
  children,
  lebar,
  tengah,
}: {
  children: React.ReactNode;
  lebar?: string;
  tengah?: boolean;
}) {
  return (
    <th
      className={`border border-[#999] px-2 py-1 font-bold ${tengah ? "text-center" : "text-left"}`}
      style={lebar ? { width: lebar } : undefined}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  tengah,
  tebal,
}: {
  children: React.ReactNode;
  tengah?: boolean;
  tebal?: boolean;
}) {
  return (
    <td
      className={`border border-[#999] px-2 py-1 align-top ${tengah ? "text-center" : ""} ${
        tebal ? "font-bold" : ""
      }`}
    >
      {children}
    </td>
  );
}
