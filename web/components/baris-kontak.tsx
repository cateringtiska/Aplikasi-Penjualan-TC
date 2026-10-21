/**
 * Baris kecil di bawah nama customer: PIC, jenis acara, dan tanggalnya.
 *
 * Dulu tersalin apa adanya di daftar Quotation dan daftar Invoice, dan
 * laporan Margin akan menjadi salinan ketiga. Aturan tampilannya sendiri
 * memang sepele, tetapi satu hal di dalamnya mudah menyimpang antar salinan:
 * barisnya HILANG ketika semuanya kosong, bukan mencetak tanda hubung atau
 * ruang kosong yang membuat tabelnya terlihat bolong.
 *
 * TANGGAL ACARA ditaruh di sini, bukan sebagai kolom tersendiri. Daftar ini
 * sudah punya dua kolom tanggal — tanggal dokumen dan jatuh tempo — dan
 * kolom ketiga membuat ketiganya saling tertukar saat dibaca sekilas.
 * Sebagai keterangan di bawah nama customer, tanggal acara terbaca sebagai
 * milik acaranya, bukan sebagai tenggat lain.
 *
 * Aturan siapa yang disebut sebagai PIC ada di lib/kontak.ts.
 */
export function BarisKontak({
  pic,
  acara,
  tanggalAcara,
}: {
  pic: string | null;
  acara: string | null;
  /** Sudah diringkas pendek; lihat ringkasTanggalAcaraPendek. */
  tanggalAcara?: string | null;
}) {
  const bagian = [pic, acara, tanggalAcara].filter((x) => x && x.trim() !== "");
  if (bagian.length === 0) return null;

  return (
    <span className="block truncate text-xs text-muted-foreground">{bagian.join(" · ")}</span>
  );
}
