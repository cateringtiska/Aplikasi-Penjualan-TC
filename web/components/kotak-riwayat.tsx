import { KotakRincian } from "@/components/kotak-rincian";

/**
 * Siapa yang menginput dokumen ini dan kapan, untuk panel samping halaman
 * detail quotation dan invoice.
 *
 * Jamnya ditulis dalam WIB secara eksplisit. Server Vercel berjalan di UTC,
 * jadi format biasa akan menampilkan jam tujuh jam lebih awal.
 */
export function KotakRiwayat({
  dibuatOleh,
  dibuatPada,
  diubahPada,
  revisi,
  dibatalkanOleh,
  dibatalkanPada,
}: {
  dibuatOleh: string | null | undefined;
  dibuatPada: Date | null;
  diubahPada: Date | null;
  revisi?: number | null;
  dibatalkanOleh?: string | null;
  dibatalkanPada?: Date | null;
}) {
  const baris: [string, string, string | null][] = [
    ["Diinput oleh", dibuatOleh || "Tidak tercatat", dibuatPada ? jamWib(dibuatPada) : null],
  ];

  // "Terakhir diubah" hanya ditampilkan kalau memang berbeda dari saat dibuat.
  if (diubahPada && (!dibuatPada || diubahPada.getTime() - dibuatPada.getTime() > 60_000)) {
    baris.push([
      "Terakhir diubah",
      jamWib(diubahPada),
      revisi && revisi > 0 ? `Revisi ke-${revisi}` : null,
    ]);
  }

  if (dibatalkanPada || dibatalkanOleh) {
    baris.push([
      "Dibatalkan oleh",
      dibatalkanOleh || "Tidak tercatat",
      dibatalkanPada ? jamWib(dibatalkanPada) : null,
    ]);
  }

  return (
    <KotakRincian judul="Riwayat input">
      <dl className="flex flex-col gap-3 text-sm">
        {baris.map(([label, nilai, keterangan]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right">
              <span className="font-medium">{nilai}</span>
              {keterangan ? (
                <span className="block text-xs text-muted-foreground">{keterangan}</span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </KotakRincian>
  );
}

const PENGATUR_JAM = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** "3 Nov 2026 14.05 WIB" */
export function jamWib(tanggal: Date): string {
  return `${PENGATUR_JAM.format(tanggal).replace(",", "")} WIB`;
}
