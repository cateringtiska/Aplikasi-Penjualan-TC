/* ==========================================================================
   KOTAK BERKEPALA

   Panel samping pada halaman quotation dan invoice: Customer, Detail acara,
   Syarat pembayaran, Riwayat payment.

   Dulu komponen ini TERSALIN apa adanya di kedua halaman. Salinan seperti
   itu menyimpang diam-diam: satu halaman dirapikan, yang lain tertinggal,
   dan tidak ada galat apa pun — hanya dua halaman yang bentuknya tidak
   sama lagi untuk hal yang sama.

   Kepalanya berupa bilah tersendiri, bukan sekadar baris teks kecil di atas
   isinya. Tanpa bilah itu, judul dan isi panel menyatu menjadi satu blok
   abu-abu, dan mata harus membaca untuk tahu di mana satu panel berakhir.
   ========================================================================== */

export function KotakRincian({
    judul,
    children,
    className,
}: {
    judul: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <section
            className={`overflow-hidden rounded-xl border border-border-strong bg-card shadow-sm ${
                className ?? ""
            }`}
        >
            <h2 className="border-b border-border-strong bg-muted/60 px-4 py-2.5 text-[0.6875rem] font-semibold tracking-[0.08em] text-foreground/75 uppercase">
                {judul}
            </h2>
            <div className="p-4">{children}</div>
        </section>
    );
}
