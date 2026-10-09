import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { cariPic, namaPic } from "../lib/kontak";
import { prisma } from "../lib/prisma";

/* ==========================================================================
   MENCARI DOKUMEN LEWAT NAMA PIC

   Nama PIC sudah tampil di daftar invoice dan quotation, tetapi mengetiknya
   di kolom pencarian tidak menemukan apa pun. Nama yang TERBACA di layar
   tetapi tidak bisa dicari adalah kegagalan yang paling membingungkan:
   pemakainya melihat namanya dengan mata sendiri, mengetiknya huruf per
   huruf, dan mendapat "Tidak ada yang cocok".

   Yang dijaga di sini bukan sekadar "pencariannya ketemu", melainkan
   PENCARIAN MENGIKUTI TAMPILAN. Kontak pada dokumen menang atas PIC tetap
   customernya, sama seperti namaPic() memilih yang ditampilkan — kalau
   keduanya dicocokkan tanpa aturan itu, hasil pencarian memuat baris yang
   nama PIC-nya di layar tidak memuat kata yang dicari sama sekali.

   Diuji terhadap database sungguhan, bukan terhadap tiruan aturannya:
   yang dipakai halaman adalah SQL-nya, dan tiruan aturan hanya
   membuktikan salinannya cocok dengan dirinya sendiri.
   ========================================================================== */

const TANDA = "UJI CARI PIC";

const jejak = {
  pelangganA: null as bigint | null,
  pelangganB: null as bigint | null,
};

beforeAll(async () => {
  const cap = Date.now().toString().slice(-6);

  // Customer dengan PIC tetap, dan dokumennya menyebut kontak LAIN.
  const a = await prisma.customers.create({
    data: {
      customer_code: `UCP-A-${cap}`,
      name: `${TANDA} Perusahaan A`,
      pic_name: "Ibu Dewi Anggraini",
      status: "active",
      created_at: new Date(),
      updated_at: new Date(),
    },
  });
  jejak.pelangganA = a.id;

  // Customer dengan PIC tetap, dan dokumennya TIDAK menyebut kontak.
  const b = await prisma.customers.create({
    data: {
      customer_code: `UCP-B-${cap}`,
      name: `${TANDA} Perusahaan B`,
      pic_name: "Ibu Reka Pertiwi",
      status: "active",
      created_at: new Date(),
      updated_at: new Date(),
    },
  });
  jejak.pelangganB = b.id;

  const buat = (nomor: string, pelanggan: bigint, kontak: string | null) =>
    prisma.invoices.create({
      data: {
        invoice_number: nomor,
        customer_id: pelanggan,
        contact_person: kontak,
        invoice_date: new Date(),
        due_date: new Date(Date.now() + 30 * 86_400_000),
        subtotal: "1000000",
        grand_total: "1000000",
        paid_amount: "0",
        status: "unpaid",
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

  await buat(`UCP-INV-A-${cap}`, a.id, "Bapak Surya Wijaya");
  await buat(`UCP-INV-B-${cap}`, b.id, null);
});

afterAll(async () => {
  await prisma.invoices.deleteMany({ where: { invoice_number: { startsWith: "UCP-INV-" } } });
  await prisma.customers.deleteMany({ where: { name: { startsWith: TANDA } } });

  const sisa = await prisma.customers.count({ where: { name: { startsWith: TANDA } } });
  expect(sisa, "seluruh data uji harus terhapus").toBe(0);

  await prisma.$disconnect();
});

/** Nomor invoice uji yang ketemu untuk satu kata kunci. */
async function cari(kunci: string): Promise<string[]> {
  const hasil = await prisma.invoices.findMany({
    where: {
      invoice_number: { startsWith: "UCP-INV-" },
      OR: cariPic(kunci),
    },
    select: { invoice_number: true },
  });
  return hasil.map((h) => h.invoice_number).sort();
}

describe("mencari lewat nama PIC", () => {
  it("menemukan dokumen lewat KONTAK yang tertulis di dokumennya", async () => {
    const hasil = await cari("Surya");
    expect(hasil).toHaveLength(1);
    expect(hasil[0]).toContain("UCP-INV-A-");
  });

  it("menemukan dokumen lewat PIC TETAP customernya", async () => {
    // Persis keadaan yang dilaporkan: mengetik "ibu reka" tidak menemukan
    // apa pun, padahal namanya terbaca di daftarnya.
    const hasil = await cari("ibu reka");
    expect(hasil).toHaveLength(1);
    expect(hasil[0]).toContain("UCP-INV-B-");
  });

  it("tidak peduli huruf besar kecilnya", async () => {
    expect(await cari("IBU REKA")).toEqual(await cari("ibu reka"));
    expect(await cari("surya")).toEqual(await cari("SURYA"));
  });

  it("menemukan dari potongan namanya, bukan hanya nama lengkap", async () => {
    expect((await cari("Pertiwi")).length).toBe(1);
    expect((await cari("Wijaya")).length).toBe(1);
  });
});

describe("pencarian mengikuti apa yang TAMPIL", () => {
  it("TIDAK menemukan PIC customer ketika dokumennya menyebut kontak lain", async () => {
    /*
     * Invoice A memakai kontaknya sendiri, "Bapak Surya Wijaya", jadi
     * itulah yang tertulis di barisnya. Mencari "Dewi" — PIC tetap
     * customernya — tidak boleh memunculkannya: pengguna akan mendapat
     * baris bertuliskan "Bapak Surya Wijaya" dan tidak ada apa pun di layar
     * yang menjelaskan kenapa baris itu ada di sana.
     */
    expect(await cari("Dewi")).toEqual([]);
  });

  it("sejalan dengan namaPic untuk tiap dokumen ujinya", async () => {
    // Dua arah: yang ketemu memang menampilkan namanya, dan yang
    // menampilkan namanya memang ketemu.
    const semua = await prisma.invoices.findMany({
      where: { invoice_number: { startsWith: "UCP-INV-" } },
      select: {
        invoice_number: true,
        contact_person: true,
        customers: { select: { pic_name: true } },
      },
    });

    for (const kunci of ["Surya", "Reka", "Dewi", "Wijaya", "Pertiwi"]) {
      const ketemu = new Set(await cari(kunci));

      for (const t of semua) {
        const tampil = namaPic(t.contact_person, t.customers.pic_name) ?? "";
        const harusnya = tampil.toLowerCase().includes(kunci.toLowerCase());

        expect(
          ketemu.has(t.invoice_number),
          `"${kunci}" vs ${t.invoice_number} yang menampilkan "${tampil}"`,
        ).toBe(harusnya);
      }
    }
  });
});
