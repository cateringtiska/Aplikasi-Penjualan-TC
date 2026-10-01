/* ==========================================================================
   PAPAN ANGKA RINGKASAN

   Satu komponen untuk seluruh kartu angka di aplikasi — Dashboard, tiga
   laporan, dan dua halaman margin. Sebelumnya setiap halaman punya salinan
   sendiri, dan salinan yang berbeda sempat memakai warna berbeda untuk arti
   yang sama.

   WARNA DI SINI MENYATAKAN KEADAAN, BUKAN KATEGORI.

   Itu bedanya antara papan yang berguna dan papan yang meriah. Kalau setiap
   kartu selalu berwarna, tidak ada yang menonjol dan pemiliknya berhenti
   memperhatikannya. Jadi warnanya hanya muncul ketika angkanya memang
   mengatakan sesuatu:

     mendesak   merah    butuh tindakan hari ini — ada yang jatuh tempo
     menunggu   kuning   menunggu tindakan — piutang berjalan, quotation
                         yang belum dijawab
     baik       hijau    sudah sebagaimana mestinya — uang masuk, margin
                         positif
     netral     polos    angka yang sekadar besaran, tidak baik atau buruk

   Angka nol hampir selalu netral: "Jatuh tempo 0" bukan kabar buruk, dan
   mewarnainya merah justru melatih orang mengabaikan warna merah.

   Tiga warnanya diambil dari palet status uang yang sudah dipakai lencana
   (lunas / sebagian / tempo), lengkap dengan versi gelapnya — jadi merah di
   kartu ini sama persis dengan merah pada lencana "Jatuh Tempo".

   SATU TEMPAT YANG SENGAJA TIDAK MEMAKAI INI: baris ringkasan di kaki
   formulir pembayaran. Bentuknya daftar mendatar yang menempel di bawah
   layar, bukan kartu — menyatukannya ke sini hanya akan memaksa dua
   kebutuhan yang berbeda ke dalam satu bentuk.
   ========================================================================== */

export type NadaAngka = "netral" | "baik" | "menunggu" | "mendesak";

const NADA: Record<NadaAngka, { angka: string; latar: string; keterangan: string }> = {
  netral: { angka: "", latar: "", keterangan: "text-muted-foreground" },
  baik: {
    angka: "text-lunas",
    latar: "bg-lunas-halus",
    keterangan: "text-lunas/80",
  },
  menunggu: {
    angka: "text-sebagian",
    latar: "bg-sebagian-halus",
    keterangan: "text-sebagian/80",
  },
  mendesak: {
    angka: "text-tempo",
    latar: "bg-tempo-halus",
    keterangan: "text-tempo/80",
  },
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
  nada = "netral",
  menonjol,
  teks,
}: {
  label: string;
  nilai: string;
  keterangan?: string;
  nada?: NadaAngka;
  menonjol?: boolean;
  /** Nilainya bukan angka — nama customer, misalnya. Tanpa tabular-nums. */
  teks?: boolean;
}) {
  const warna = NADA[nada];

  return (
    <div className={`px-4 py-4 sm:px-5 ${warna.latar}`}>
      <p className="eyebrow">{label}</p>
      <p
        className={`mt-1.5 font-semibold tracking-[-0.025em] ${
          teks ? "text-base" : `angka tabular-nums ${menonjol ? "text-[1.375rem]" : "text-lg"}`
        } ${warna.angka}`}
      >
        {nilai}
      </p>
      {keterangan ? (
        <p className={`mt-0.5 text-xs ${warna.keterangan}`}>{keterangan}</p>
      ) : null}
    </div>
  );
}
