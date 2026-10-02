import { describe, expect, it } from "vitest";

import { barisUntukDisimpan, siapkanDokumen } from "./dokumen";

/* ==========================================================================
   TANDA HUBUNG YANG DIKETIK BERARTI KOSONG

   Orang mengetik "-" untuk menyatakan "tidak ada" — kebiasaan dari mengisi
   formulir kertas. Aplikasi memperlakukannya sebagai isi yang sah, dan
   hasilnya terbaca di dokumen yang dikirim ke klien: judul "INVOICE - -",
   karena jenis acaranya memang berisi satu tanda hubung.

   Ditemukan pemiliknya pada invoice sungguhan yang pertama.

   Yang dikosongkan HANYA nilai yang seluruhnya tanda hubung. Alamat seperti
   "The Telkom Hub - Jl. Gatot Subroto" harus tetap utuh — kalau aturannya
   terlalu rakus, justru alamat venue yang hilang dari dokumen.
   ========================================================================== */

const DASAR = {
  customer_id: "1",
  tanggal: "2026-06-30",
  tanggal_akhir: "2026-09-30",
  items: [{ item_name: "Nasi box", qty: "35", price: "78500" }],
};

function siapkan(tambahan: Record<string, unknown>) {
  const hasil = siapkanDokumen({ ...DASAR, ...tambahan }, { labelTanggalAkhir: "Jatuh tempo" });
  if (!hasil.ok) throw new Error("tidak lolos validasi: " + JSON.stringify(hasil.keadaan));
  return hasil.kolom;
}

describe("isian yang hanya berisi tanda hubung", () => {
  it("dikosongkan, bukan disimpan apa adanya", () => {
    const kolom = siapkan({
      event_type: "-",
      event_time: "  -  ",
      venue: "--",
      fnb_planner: "–",
      contact_person: "-",
      contact_phone: "-",
      notes: "-",
    });

    expect(kolom.event_type).toBeNull();
    expect(kolom.event_time).toBeNull();
    expect(kolom.venue).toBeNull();
    expect(kolom.fnb_planner).toBeNull();
    expect(kolom.contact_person).toBeNull();
    expect(kolom.contact_phone).toBeNull();
    expect(kolom.notes).toBeNull();
  });

  it("TIDAK mengosongkan isian yang kebetulan memuat tanda hubung", () => {
    const kolom = siapkan({
      venue: "The Telkom Hub - Jl. Gatot Subroto No.Kav.52",
      event_type: "Coffee Break - Pagi",
      contact_phone: "0813-1163-7295",
    });

    expect(kolom.venue).toBe("The Telkom Hub - Jl. Gatot Subroto No.Kav.52");
    expect(kolom.event_type).toBe("Coffee Break - Pagi");
    expect(kolom.contact_phone).toBe("0813-1163-7295");
  });

  it("merapikan spasi di tepi isian biasa", () => {
    expect(siapkan({ event_type: "  Gathering  " }).event_type).toBe("Gathering");
  });
});

/* ==========================================================================
   BIAYA TAMBAHAN BERNAMA

   Baris di luar service charge dan PB1, sama kedudukannya dengan delivery
   tetapi namanya bebas dan jumlahnya boleh lebih dari satu. Dokumen katering
   sungguhan memuat "Tim Servis utk Menu Buffet (1 orang)" dan "Tambahan
   Set-up & Layanan 1 Titik VIP Buffet" — bentuk yang tidak mungkin ditebak
   sebelumnya, jadi tidak bisa dijadikan kolom tetap.
   ========================================================================== */

function coba(tambahan: Record<string, unknown>) {
  return siapkanDokumen({ ...DASAR, ...tambahan }, { labelTanggalAkhir: "Jatuh tempo" });
}

describe("biaya tambahan", () => {
  it("masuk ke grand total tanpa mengubah subtotal", () => {
    const hasil = coba({
      biaya_tambahan: [
        { label: "Tim Servis utk Menu Buffet (1 orang)", amount: "350.000" },
        { label: "Tambahan Set-up & Layanan 1 Titik VIP Buffet", amount: "1.350.000" },
      ],
    });

    if (!hasil.ok) throw new Error(JSON.stringify(hasil.keadaan));

    // 35 x 78.500 = 2.747.500 — subtotalnya tidak boleh bergeser.
    expect(hasil.kolom.subtotal).toBe("2747500.00");
    expect(hasil.kolom.grand_total).toBe("4447500.00");
    expect(hasil.tambahan.map((b) => b.label)).toEqual([
      "Tim Servis utk Menu Buffet (1 orang)",
      "Tambahan Set-up & Layanan 1 Titik VIP Buffet",
    ]);
  });

  it("MEMBUANG baris yang kosong sama sekali", () => {
    // Orang menambah baris lalu berubah pikiran. Memaksanya menghapus baris
    // kosong sebelum boleh menyimpan hanya menghalangi.
    const hasil = coba({
      biaya_tambahan: [
        { label: "", amount: "" },
        { label: "Set-up panggung", amount: "500.000" },
        { label: "   ", amount: "  " },
      ],
    });

    if (!hasil.ok) throw new Error(JSON.stringify(hasil.keadaan));
    expect(hasil.tambahan).toHaveLength(1);
    expect(hasil.kolom.grand_total).toBe("3247500.00");
  });

  it("MENOLAK jumlah yang tidak bernama", () => {
    // Angka tanpa keterangan di dokumen yang dikirim ke customer akan
    // ditanyakan balik, dan saat itu tidak ada yang masih ingat untuk apa.
    const hasil = coba({ biaya_tambahan: [{ label: "", amount: "750.000" }] });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.keadaan.galat?.biaya_tambahan).toMatch(/namanya belum diisi/i);
  });

  it("menerima baris bernama yang jumlahnya belum diisi", () => {
    // Namanya sudah diketik, angkanya menyusul. Membuangnya diam-diam akan
    // menghapus ketikan orang tanpa memberitahu.
    const hasil = coba({ biaya_tambahan: [{ label: "Menyusul", amount: "" }] });

    if (!hasil.ok) throw new Error(JSON.stringify(hasil.keadaan));
    expect(hasil.tambahan).toHaveLength(1);
    expect(hasil.tambahan[0].amount.toString()).toBe("0");
  });
});

/* ==========================================================================
   KOLOM ANGKA YANG DIBIARKAN KOSONG

   Dilaporkan pemiliknya dari invoice sungguhan. Baris "PROPS VIP DECORATION
   - Set-up VIP Table" adalah judul kelompok: jumlah 0, kolom harga dibiarkan
   KOSONG, dan sub-item "Goblet (Gelas Kaki)" membawa angkanya (33 x 10.000).

   Penyimpanannya ditolak dengan kalimat "Baris 6: harga tidak boleh minus."
   Tidak ada angka minus di mana pun pada formulirnya. Kolom kosong terbaca
   sebagai "tidak terbaca", dan satu-satunya kalimat galat yang tersedia
   untuk keadaan itu menyebut minus — jadi orang mencari angka minus yang
   tidak pernah ada, pada baris yang justru memang seharusnya kosong.

   Dua hal yang dikunci: kolom kosong berarti NOL, dan kalimat galat harus
   menyebutkan keadaan yang sebenarnya.
   ========================================================================== */

describe("kolom angka yang dibiarkan kosong", () => {
  it("menerima judul kelompok yang kolom harganya kosong", () => {
    const hasil = coba({
      items: [
        {
          item_name: "PROPS VIP DECORATION - Set-up VIP Table",
          qty: "0",
          price: "",
          children: [{ item_name: "Goblet (Gelas Kaki)", unit: "Pcs", qty: "33", price: "10000" }],
        },
      ],
    });

    if (!hasil.ok) throw new Error(JSON.stringify(hasil.keadaan));
    expect(hasil.kolom.subtotal).toBe("330000.00");
    expect(hasil.kolom.grand_total).toBe("330000.00");
  });

  it("memperlakukan harga kosong sebagai nol pada baris biasa", () => {
    const hasil = coba({
      items: [{ item_name: "Tenda", qty: "2", price: "", children: [] }],
    });

    if (!hasil.ok) throw new Error(JSON.stringify(hasil.keadaan));
    expect(hasil.kolom.subtotal).toBe("0.00");
  });

  it("TIDAK menyebut minus untuk harga yang sekadar tidak terbaca", () => {
    const hasil = coba({
      items: [{ item_name: "Tenda", qty: "2", price: "dua ratus ribu", children: [] }],
    });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.keadaan.galat?.items).toMatch(/tidak terbaca/i);
    expect(hasil.keadaan.galat?.items).not.toMatch(/minus/i);
  });

  it("tetap menolak harga yang benar-benar minus", () => {
    const hasil = coba({
      items: [{ item_name: "Tenda", qty: "2", price: "-5000", children: [] }],
    });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.keadaan.galat?.items).toMatch(/tidak boleh minus/i);
  });
});

/* ==========================================================================
   JUDUL YANG TIDAK PUNYA ANGKA SAMA SEKALI

   Bentuk kedua dari judul kelompok, dilaporkan pemiliknya dari invoice
   sungguhan: "STALL/ GUBUKAN (10.30 WIB ready to serve) - Menu dari Luar",
   dengan empat sub-item yang semuanya hanya nama — Toge Goreng, Sate
   Cungkring, Bakso, Asinan Bogor Gedong Dalem. Tidak ada satu angka pun.

   Aturan sebelumnya hanya mengenali judul dari sub-item yang BERHARGA, jadi
   baris ini ditolak dan disuruh "isi dulu jumlah dan harga pada sub-itemnya"
   — padahal memang tidak ada yang ditagihkan di situ.

   Yang tetap harus ditolak adalah keadaan yang merugikan: harga terisi,
   jumlah nol. Baris itu tidak akan menagih apa pun padahal jelas dimaksudkan
   menagih, dan totalnya tetap terlihat wajar.
   ========================================================================== */

describe("judul tanpa angka", () => {
  it("menerima judul yang sub-itemnya hanya daftar nama", () => {
    const hasil = coba({
      items: [
        { item_name: "Nasi box", qty: "35", price: "78500", children: [] },
        {
          item_name: "STALL/ GUBUKAN (10.30 WIB ready to serve) - Menu dari Luar",
          qty: "0",
          price: "",
          children: [
            { item_name: "Toge Goreng" },
            { item_name: "Sate Cungkring" },
            { item_name: "Bakso" },
            { item_name: "Asinan Bogor Gedong Dalem" },
          ],
        },
      ],
    });

    if (!hasil.ok) throw new Error(JSON.stringify(hasil.keadaan));

    // Barisnya tidak menambah apa pun: subtotal tetap 35 x 78.500.
    expect(hasil.kolom.subtotal).toBe("2747500.00");
    expect(hasil.items[1].qtyD.toString()).toBe("0");
    expect(hasil.items[1].priceD.toString()).toBe("0");
  });

  it("menerima baris judul polos tanpa sub-item sama sekali", () => {
    // Bentuk yang dipakai di dokumen aslinya: "MEAL ARRANGEMENT",
    // "MESJID ISTIQLAL - Jakarta Pusat", "10.00 WIB ready to serve".
    const hasil = coba({
      items: [
        { item_name: "MEAL ARRANGEMENT", qty: "", price: "", children: [] },
        { item_name: "Nasi box", qty: "35", price: "78500", children: [] },
      ],
    });

    if (!hasil.ok) throw new Error(JSON.stringify(hasil.keadaan));
    expect(hasil.kolom.subtotal).toBe("2747500.00");
  });

  it("TETAP MENOLAK harga yang terisi dengan jumlah nol", () => {
    // Inilah salah ketik yang merugikan, dan penjagaannya tidak boleh ikut
    // hilang: customer tidak jadi ditagih untuk sesuatu yang jelas hendak
    // ditagihkan, sementara totalnya tetap terlihat wajar.
    const hasil = coba({
      items: [{ item_name: "Nasi box", qty: "0", price: "78500", children: [] }],
    });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.keadaan.galat?.items).toMatch(/tidak akan menagih apa pun/i);
  });

  it("menolak jumlah minus dengan menyebut minus", () => {
    const hasil = coba({
      items: [{ item_name: "Nasi box", qty: "-5", price: "78500", children: [] }],
    });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.keadaan.galat?.items).toMatch(/jumlah tidak boleh minus/i);
  });
});

/* ==========================================================================
   POTONGAN DAN PEMBULATAN

   Diminta pemiliknya: baris "Rounded -65.000". Pembulatan dan diskon adalah
   baris yang MENGURANGI, dan di dokumen katering keduanya memang ditulis di
   bagian biaya tambahan, sesudah service charge dan PB1.

   Minus tetap ditolak pada BARIS ITEM, karena di sana ia selalu salah ketik —
   potongan tidak pernah ditulis sebagai harga satuan minus.

   Penjagaan yang menggantikannya: total dokumen tidak boleh minus. Dokumen
   bertotal minus berarti perusahaan yang berutang kepada customer, dan
   hampir selalu itu satu angka nol kelebihan pada baris potongannya.
   ========================================================================== */

describe("potongan dan pembulatan", () => {
  it("menerima biaya tambahan yang minus", () => {
    const hasil = coba({
      biaya_tambahan: [
        { label: "Tim Servis utk Menu Buffet (1 orang)", amount: "350.000" },
        { label: "Rounded", amount: "-65000" },
      ],
    });

    if (!hasil.ok) throw new Error(JSON.stringify(hasil.keadaan));

    // 2.747.500 + 350.000 - 65.000
    expect(hasil.kolom.grand_total).toBe("3032500.00");
    expect(hasil.tambahan[1].amount.toString()).toBe("-65000");
  });

  it("tidak mengubah PB1 maupun service charge", () => {
    // Potongan di sini berlaku SESUDAH kedua pungutan. Yang ingin memotong
    // sebelum pajak harus menurunkan harga itemnya, bukan menambah baris ini.
    const tanpa = coba({ service_charge_percent: "10", pb1_enabled: true, pb1_percent: "10" });
    const dengan = coba({
      service_charge_percent: "10",
      pb1_enabled: true,
      pb1_percent: "10",
      biaya_tambahan: [{ label: "Diskon", amount: "-500000" }],
    });

    if (!tanpa.ok || !dengan.ok) throw new Error("tidak lolos validasi");

    expect(dengan.kolom.service_charge_amount).toBe(tanpa.kolom.service_charge_amount);
    expect(dengan.kolom.pb1_amount).toBe(tanpa.kolom.pb1_amount);
  });

  it("menerima potongan yang tepat menghabiskan nilai dokumen", () => {
    // Acara yang digratiskan seluruhnya — sah, jadi yang dijaga bukan besar
    // potongannya melainkan totalnya.
    const hasil = coba({
      biaya_tambahan: [{ label: "Compliment penuh", amount: "-2747500" }],
    });

    if (!hasil.ok) throw new Error(JSON.stringify(hasil.keadaan));
    expect(hasil.kolom.grand_total).toBe("0.00");
  });

  it("MENOLAK potongan yang membuat total menjadi minus", () => {
    // Satu angka nol kelebihan: -650.000 diketik -6.500.000.
    const hasil = coba({
      biaya_tambahan: [{ label: "Rounded", amount: "-6500000" }],
    });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.keadaan.galat?.biaya_tambahan).toMatch(/melebihi nilai dokumen/i);
  });

  it("TETAP MENOLAK harga minus pada baris item", () => {
    const hasil = coba({
      items: [{ item_name: "Nasi box", qty: "35", price: "-78500", children: [] }],
    });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.keadaan.galat?.items).toMatch(/harga tidak boleh minus/i);
  });

  it("menyebutkan contoh minus pada angka yang tidak terbaca", () => {
    const hasil = coba({ biaya_tambahan: [{ label: "Rounded", amount: "kurangi" }] });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.keadaan.galat?.biaya_tambahan).toMatch(/-65\.000/);
  });
});

/* ==========================================================================
   TANGGAL ACARA LEBIH DARI SATU

   Jumlah hari DIHITUNG dari banyaknya tanggal, tidak diketik. Diketik
   terpisah, keduanya bisa berbeda — dan dokumen yang menyebut "3 hari"
   dengan dua tanggal tercetak tidak akan ditegur siapa pun.

   Tanggalnya dirakit sebagai tengah malam UTC. Kolomnya bertipe DATE; tengah
   malam SETEMPAT di zona timur tersimpan mundur sehari, dokumennya tetap
   terbit, dan hari yang salah itu baru ketahuan saat orang katering datang.
   ========================================================================== */

describe("tanggal acara", () => {
  it("menghitung jumlah hari dari banyaknya tanggal", () => {
    const hasil = coba({ event_dates: ["2026-05-10", "2026-05-12", "2026-05-15"] });

    if (!hasil.ok) throw new Error(JSON.stringify(hasil.keadaan));
    expect(hasil.kolom.event_days).toBe(3);
  });

  it("menyimpan tanggal PALING AWAL di kolom tanggal acara", () => {
    // Dikirim tidak urut; daftar quotation memakai kolom ini untuk mengurut.
    const hasil = coba({ event_dates: ["2026-05-15", "2026-05-10", "2026-05-12"] });

    if (!hasil.ok) throw new Error(JSON.stringify(hasil.keadaan));
    expect(hasil.kolom.event_date?.toISOString().slice(0, 10)).toBe("2026-05-10");
  });

  it("TIDAK menggeser tanggal sehari, di zona waktu mana pun", () => {
    const hasil = coba({ event_dates: ["2026-05-10"] });

    if (!hasil.ok) throw new Error(JSON.stringify(hasil.keadaan));
    const t = hasil.tanggalAcara[0];

    // Diperiksa per bagian UTC, bukan lewat toISOString saja: ini yang gagal
    // kalau tanggalnya dirakit sebagai tengah malam setempat.
    expect([t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()]).toEqual([2026, 5, 10]);
    expect(t.getUTCHours()).toBe(0);
  });

  it("membuang tanggal kembar sebelum menghitung harinya", () => {
    const hasil = coba({ event_dates: ["2026-05-10", "2026-05-10", "2026-05-11"] });

    if (!hasil.ok) throw new Error(JSON.stringify(hasil.keadaan));
    expect(hasil.kolom.event_days).toBe(2);
    expect(hasil.tanggalAcara).toHaveLength(2);
  });

  it("mengabaikan baris tanggal yang dibiarkan kosong", () => {
    const hasil = coba({ event_dates: ["2026-05-10", "", "  "] });

    if (!hasil.ok) throw new Error(JSON.stringify(hasil.keadaan));
    expect(hasil.kolom.event_days).toBe(1);
  });

  it("dokumen tanpa tanggal acara tetap boleh disimpan", () => {
    const hasil = coba({ event_dates: [] });

    if (!hasil.ok) throw new Error(JSON.stringify(hasil.keadaan));
    expect(hasil.kolom.event_date).toBeNull();
    expect(hasil.kolom.event_days).toBeNull();
  });

  it("MENOLAK bentuk tanggal yang bukan tahun-bulan-hari", () => {
    // new Date("2026") menghasilkan 1 Januari tanpa mengeluh sedikit pun.
    for (const buruk of ["2026", "10/05/2026", "besok"]) {
      const hasil = coba({ event_dates: [buruk] });
      expect(hasil.ok, `"${buruk}" seharusnya ditolak`).toBe(false);
      if (!hasil.ok) expect(hasil.keadaan.galat?.event_dates).toMatch(/tidak terbaca/i);
    }
  });
});

/* ==========================================================================
   KOLOM HARI PADA BARIS ITEM
   ========================================================================== */

describe("kolom hari", () => {
  it("mengalikan nilai baris dan menyimpannya", () => {
    const hasil = coba({
      items: [{ item_name: "Lunch box", day: "3", qty: "130", price: "58500", children: [] }],
    });

    if (!hasil.ok) throw new Error(JSON.stringify(hasil.keadaan));
    expect(hasil.kolom.subtotal).toBe("22815000.00");
    expect(hasil.items[0].dayD.toString()).toBe("3");
  });

  it("KOSONG BERARTI SATU", () => {
    // Formulir dokumen lama tidak mengirim kolom ini sama sekali.
    const hasil = coba({
      items: [{ item_name: "Lunch box", qty: "130", price: "58500", children: [] }],
    });

    if (!hasil.ok) throw new Error(JSON.stringify(hasil.keadaan));
    expect(hasil.kolom.subtotal).toBe("7605000.00");
    expect(hasil.items[0].dayD.toString()).toBe("1");
  });

  it("MENOLAK hari nol", () => {
    // Nol tidak dianggap satu: baris berhari nol tidak menagih apa pun,
    // sementara dokumennya tetap terlihat wajar.
    const hasil = coba({
      items: [{ item_name: "Lunch box", day: "0", qty: "130", price: "58500", children: [] }],
    });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.keadaan.galat?.items).toMatch(/minimal 1/i);
  });

  it("MENOLAK hari minus dan hari yang tidak terbaca", () => {
    for (const buruk of ["-2", "tiga"]) {
      const hasil = coba({
        items: [{ item_name: "Lunch box", day: buruk, qty: "130", price: "58500", children: [] }],
      });
      expect(hasil.ok, `"${buruk}" seharusnya ditolak`).toBe(false);
    }
  });

  it("menurunkan harinya ke sub-item yang disimpan", () => {
    // Baris sub-item yang tersimpan berhari 1 sementara nilainya sudah
    // dikali tiga adalah baris yang angkanya tidak menjelaskan nilainya.
    const hasil = coba({
      items: [
        {
          item_name: "Aneka Stall",
          day: "3",
          qty: "0",
          price: "",
          children: [{ item_name: "Bakwan Malang", qty: "35", price: "39500" }],
        },
      ],
    });

    if (!hasil.ok) throw new Error(JSON.stringify(hasil.keadaan));

    const { anak } = barisUntukDisimpan(hasil.items)[0];
    expect(anak[0].day).toBe("3.00");
    expect(anak[0].subtotal).toBe("4147500.00"); // 3 x 35 x 39.500
    expect(hasil.kolom.subtotal).toBe("4147500.00");
  });
});

/* ==========================================================================
   HARI PADA SUB-ITEM

   Diminta pemiliknya setelah kolom hari ada di baris induk. Yang menentukan
   bentuknya: hari sub-item yang DIBIARKAN KOSONG berarti "sama seperti
   induknya", bukan satu. Kalau kosong berarti satu, satu stall tiga hari
   mendadak hanya menagih sehari untuk seluruh isinya — sementara baris
   induknya tetap menyebut tiga hari, jadi dokumennya membantah dirinya
   sendiri.
   ========================================================================== */

describe("hari pada sub-item", () => {
  const stall = (anak: Record<string, unknown>[]) => ({
    items: [
      { item_name: "Aneka Stall", day: "3", qty: "0", price: "", children: anak },
    ],
  });

  it("KOSONG berarti mengikuti induknya", () => {
    const hasil = coba(stall([{ item_name: "Bakwan Malang", qty: "35", price: "39500" }]));

    if (!hasil.ok) throw new Error(JSON.stringify(hasil.keadaan));
    expect(hasil.items[0].anakSiap[0].dayD.toString()).toBe("3");
    expect(hasil.kolom.subtotal).toBe("4147500.00"); // 3 x 35 x 39.500
  });

  it("boleh berbeda dari induknya", () => {
    // Satu menu yang hanya disajikan hari pertama dari tiga hari acara.
    const hasil = coba(
      stall([
        { item_name: "Bakwan Malang", qty: "35", price: "39500" },
        { item_name: "Tumpeng pembuka", day: "1", qty: "1", price: "500000" },
      ]),
    );

    if (!hasil.ok) throw new Error(JSON.stringify(hasil.keadaan));
    expect(hasil.items[0].anakSiap[0].dayD.toString()).toBe("3");
    expect(hasil.items[0].anakSiap[1].dayD.toString()).toBe("1");

    // 3 x 35 x 39.500 + 1 x 1 x 500.000
    expect(hasil.kolom.subtotal).toBe("4647500.00");
  });

  it("harinya ikut tersimpan di baris sub-itemnya", () => {
    const hasil = coba(
      stall([{ item_name: "Tumpeng pembuka", day: "1", qty: "1", price: "500000" }]),
    );

    if (!hasil.ok) throw new Error(JSON.stringify(hasil.keadaan));
    const { anak } = barisUntukDisimpan(hasil.items)[0];
    expect(anak[0].day).toBe("1.00");
    expect(anak[0].subtotal).toBe("500000.00");
  });

  it("MENOLAK hari sub-item yang nol atau tidak terbaca", () => {
    for (const buruk of ["0", "-1", "dua"]) {
      const hasil = coba(
        stall([{ item_name: "Bakwan Malang", day: buruk, qty: "35", price: "39500" }]),
      );
      expect(hasil.ok, `"${buruk}" seharusnya ditolak`).toBe(false);
      if (!hasil.ok) expect(hasil.keadaan.galat?.items).toMatch(/sub-item 1/i);
    }
  });

  it("sub-item tanpa angka tidak terpengaruh hari induknya", () => {
    // Daftar isi paket: tidak berharga, jadi tetap nol berapa pun harinya.
    const hasil = coba({
      items: [
        {
          item_name: "Lunch Box",
          day: "3",
          qty: "130",
          price: "58500",
          children: [{ item_name: "Nasi Putih" }, { item_name: "Kerupuk" }],
        },
      ],
    });

    if (!hasil.ok) throw new Error(JSON.stringify(hasil.keadaan));
    expect(hasil.kolom.subtotal).toBe("22815000.00"); // 3 x 130 x 58.500
  });
});
