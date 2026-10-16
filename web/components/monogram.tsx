import { cn } from "@/lib/utils";

/**
 * Monogram TC.
 *
 * Sengaja bukan ikon dan bukan emoji — dua huruf di dalam kotak, sama seperti
 * cap yang muncul di sudut kop penawaran. Bentuknya tetap terbaca sampai
 * ukuran 20px, jadi bisa dipakai di navigasi maupun di halaman masuk.
 *
 * Warnanya emas logo Tiska, dengan huruf gelap di atasnya. Emas di atas
 * putih tidak punya cukup beda terang untuk dibaca; yang dibalik justru
 * bisa.
 */
export function Monogram({
  className,
  ukuran = 36,
}: {
  className?: string;
  ukuran?: number;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-[0.3rem] bg-[var(--emas)] font-semibold tracking-[-0.03em] text-[oklch(0.22_0.03_80)] shadow-sm",
        className,
      )}
      style={{
        width: ukuran,
        height: ukuran,
        fontSize: ukuran * 0.4,
      }}
      aria-hidden="true"
    >
      TC
    </span>
  );
}
