/* ==========================================================================
   KEPALA TABEL LAYAR

   Dipakai semua daftar di aplikasi: invoice, quotation, payment, customer,
   produk, pengguna, dan ketiga laporan.

   Dulu kepala dan sel ini TERSALIN apa adanya di enam belas berkas. Salinan
   sebanyak itu menyimpang diam-diam: satu halaman dirapikan, lima belas
   lainnya tertinggal, dan tidak ada galat apa pun — hanya aplikasi yang
   tabelnya tidak lagi seragam. Itu sudah pernah terjadi di sini.

   Kepalanya dibuat tegas — latar sendiri, garis bawah yang terlihat, huruf
   tebal — karena daftar di aplikasi ini panjang dan sering digulir. Kepala
   yang sepucat isinya ikut hilang begitu barisnya lewat, dan yang membaca
   harus menghitung kolom untuk tahu angka yang dilihatnya "Nilai" atau
   "Sisa".
   ========================================================================== */

export function KepalaTabel({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-border-strong bg-muted/60">{children}</tr>
    </thead>
  );
}

export function Th({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-2.5 text-left text-[0.6875rem] font-semibold tracking-[0.08em] text-foreground/75 uppercase ${className ?? ""}`}
    >
      {children}
    </th>
  );
}
