/* ==========================================================================
   SIAPA YANG DIHUBUNGI

   Nama orang tersimpan di dua tempat, dan keduanya sering terisi sekaligus:

     contact_person pada dokumennya   "UP - Kepada" pada invoice ini
     pic_name pada customernya        orang tetap di perusahaan itu

   Aturannya dikumpulkan di sini, bukan diulang di tiap daftar. Tiga halaman
   menampilkannya, dan tiga salinan aturan yang sama akan menyimpang.
   ========================================================================== */

/**
 * Nama PIC yang ditampilkan di daftar dokumen.
 *
 * YANG MENANG ADALAH KONTAK PADA DOKUMENNYA. Satu customer besar bisa punya
 * beberapa orang yang memesan — Human Capital, Marketing, Sekretariat — dan
 * yang ditelepon untuk invoice ini adalah orang yang namanya tertulis di
 * invoice ini, bukan nama tetap di data customernya.
 *
 * Terbalik, daftar tagihan akan menyebut satu nama yang sama untuk seluruh
 * invoice sebuah perusahaan, dan nama itu belum tentu tahu apa-apa tentang
 * pesanannya.
 *
 * Mengembalikan null kalau keduanya kosong, supaya pemanggilnya bisa
 * menyembunyikan barisnya — bukan mencetak tanda hubung yang tidak
 * menjelaskan apa pun.
 */
export function namaPic(
  kontakDokumen: string | null | undefined,
  picCustomer: string | null | undefined,
): string | null {
  const dokumen = (kontakDokumen ?? "").trim();
  if (dokumen !== "") return dokumen;

  const customer = (picCustomer ?? "").trim();
  return customer === "" ? null : customer;
}

/**
 * Label satu customer pada daftar pilihan.
 *
 * Nama saja tidak cukup membedakan. Pada data sungguhan ada DUA customer
 * bernama "Meet The Bride - WO" — pekerjaan yang berbeda dari perencana yang
 * sama. Yang memilih dari daftar tidak punya cara menebak mana yang mana,
 * dan salah pilih berarti invoice terkirim ke orang yang salah.
 *
 * Jadi kodenya selalu disebut, dan nama PIC-nya disebut kalau ada — itu yang
 * benar-benar dikenali orang, lebih daripada nomor customer.
 */
export function labelPelanggan(p: {
  nama: string;
  kode: string;
  pic?: string | null;
}): string {
  const pic = (p.pic ?? "").trim();
  return `${p.nama} (${p.kode})${pic === "" ? "" : ` · ${pic}`}`;
}
