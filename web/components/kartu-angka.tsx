/* ==========================================================================
   PAPAN ANGKA RINGKASAN

   Satu komponen untuk seluruh kartu angka di aplikasi — Dashboard, tiga
   laporan, dan tiga halaman rincian. Sebelumnya setiap halaman punya salinan
   sendiri, dan salinan yang berbeda sempat memakai warna berbeda untuk arti
   yang sama.

   SETIAP KARTU PUNYA WARNANYA SENDIRI, dan dalam satu papan tidak ada dua
   kartu berwarna sama. Ini permintaan pemiliknya: tidak ada kartu yang polos,
   supaya seluruh angka ringkasan langsung tertangkap mata.

   Warnanya menandai KARTU MANA, bukan baik-buruknya angka. Jadi kartu
   "Jatuh tempo" tetap merah walau isinya nol — merahnya menyatakan topik,
   bukan peringatan. Yang menyatakan keadaan adalah angkanya sendiri dan
   keterangan di bawahnya ("perlu ditagih" / "tidak ada").

   Satu pengecualian yang tetap dipertahankan: kartu margin berpindah ke
   merah ketika hasilnya RUGI. Di sana warna memang menyatakan keadaan,
   karena rugi adalah satu-satunya angka di papan ini yang maknanya berbalik.

   Tujuh warna disusun dengan lightness dan chroma sekelas, hanya hue-nya
   yang berbeda — supaya tidak ada satu kartu pun yang berteriak lebih keras
   dari tetangganya. Semuanya punya pasangan untuk mode gelap.

   KUNING, ORANYE, DAN MERAH BERDEKATAN HUE-NYA, dan memang begitu adanya:
   ketiganya satu tangga di papan umur piutang, tempat warnanya menanjak
   mengikuti keterlambatan. Tetapi pada papan yang artinya TIDAK bertangga,
   menaruh ketiganya bersamaan membuat kartu yang maknanya jauh berbeda
   terlihat mirip — itu yang dilaporkan pemiliknya tentang dashboard. Di
   papan seperti itu pakailah warna yang hue-nya berjauhan.

   SATU TEMPAT YANG SENGAJA TIDAK MEMAKAI INI: baris ringkasan di kaki
   formulir pembayaran. Bentuknya daftar mendatar yang menempel di bawah
   layar, bukan kartu — menyatukannya ke sini hanya akan memaksa dua
   kebutuhan yang berbeda ke dalam satu bentuk.
   ========================================================================== */

export type WarnaKartu =
  | "hijau"
  | "kuning"
  | "oranye"
  | "merah"
  | "biru"
  | "ungu"
  | "toska";

const WARNA: Record<WarnaKartu, { angka: string; latar: string; keterangan: string }> = {
  hijau: { angka: "text-lunas", latar: "bg-lunas-halus", keterangan: "text-lunas/80" },
  kuning: {
    angka: "text-sebagian",
    latar: "bg-sebagian-halus",
    keterangan: "text-sebagian/80",
  },
  oranye: { angka: "text-oranye", latar: "bg-oranye-halus", keterangan: "text-oranye/80" },
  merah: { angka: "text-tempo", latar: "bg-tempo-halus", keterangan: "text-tempo/80" },
  biru: { angka: "text-biru", latar: "bg-biru-halus", keterangan: "text-biru/80" },
  ungu: { angka: "text-ungu", latar: "bg-ungu-halus", keterangan: "text-ungu/80" },
  toska: { angka: "text-toska", latar: "bg-toska-halus", keterangan: "text-toska/80" },
};

/**
 * Wadah kartu angka: satu papan, bukan beberapa kartu terpisah.
 *
 * `kolom` menentukan jumlah kolom pada layar lebar; di ponsel selalu dua,
 * supaya angkanya tidak terpotong.
 */
export function PapanAngka({
  children,
  kolom = 4,
  className = "",
}: {
  children: React.ReactNode;
  kolom?: 3 | 4;
  className?: string;
}) {
  const sebar = kolom === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4";

  return (
    <section
      className={`grid grid-cols-2 divide-border overflow-hidden rounded-lg border bg-card ${sebar} sm:divide-x ${className}`}
    >
      {children}
    </section>
  );
}

export function KartuAngka({
  label,
  nilai,
  keterangan,
  warna,
  menonjol,
  teks,
}: {
  label: string;
  nilai: string;
  keterangan?: string;
  /** Warna kartu ini. Dalam satu papan, jangan ada dua yang sama. */
  warna: WarnaKartu;
  menonjol?: boolean;
  /** Nilainya bukan angka — nama customer, misalnya. Tanpa tabular-nums. */
  teks?: boolean;
}) {
  const w = WARNA[warna];

  return (
    <div className={`px-4 py-4 sm:px-5 ${w.latar}`}>
      <p className="eyebrow">{label}</p>
      <p
        className={`mt-1.5 font-semibold tracking-[-0.025em] ${
          teks ? "text-base" : `angka tabular-nums ${menonjol ? "text-[1.375rem]" : "text-lg"}`
        } ${w.angka}`}
      >
        {nilai}
      </p>
      {keterangan ? <p className={`mt-0.5 text-xs ${w.keterangan}`}>{keterangan}</p> : null}
    </div>
  );
}
