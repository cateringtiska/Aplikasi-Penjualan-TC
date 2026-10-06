/**
 * Baris kecil di bawah nama customer: PIC dan jenis acaranya.
 *
 * Dulu tersalin apa adanya di daftar Quotation dan daftar Invoice, dan
 * laporan Margin akan menjadi salinan ketiga. Aturan tampilannya sendiri
 * memang sepele, tetapi satu hal di dalamnya mudah menyimpang antar salinan:
 * barisnya HILANG ketika keduanya kosong, bukan mencetak tanda hubung atau
 * ruang kosong yang membuat tabelnya terlihat bolong.
 *
 * Aturan siapa yang disebut sebagai PIC ada di lib/kontak.ts.
 */
export function BarisKontak({ pic, acara }: { pic: string | null; acara: string | null }) {
  const bagian = [pic, acara].filter((x) => x && x.trim() !== "");
  if (bagian.length === 0) return null;

  return (
    <span className="block truncate text-xs text-muted-foreground">{bagian.join(" · ")}</span>
  );
}
