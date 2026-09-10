import { cn } from "@/lib/utils";

/**
 * Monogram TC.
 *
 * Sengaja bukan ikon dan bukan emoji — dua huruf di dalam kotak, sama seperti
 * cap yang muncul di sudut kop penawaran. Bentuknya tetap terbaca sampai
 * ukuran 20px, jadi bisa dipakai di navigasi maupun di halaman masuk.
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
        "inline-flex shrink-0 select-none items-center justify-center rounded-[0.3rem] bg-primary font-semibold tracking-[-0.03em] text-primary-foreground",
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
