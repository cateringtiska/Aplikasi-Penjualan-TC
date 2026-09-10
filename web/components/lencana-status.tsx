import { cn } from "@/lib/utils";

/**
 * Lencana status.
 *
 * Inilah satu-satunya tempat warna dipakai di aplikasi ini. Karena sisa
 * antarmuka monokrom, sepotong warna kecil di sini langsung menarik mata —
 * yang persis tujuannya. Bentuknya juga berbeda per status (titik penuh vs
 * cincin), supaya tetap terbaca oleh pengguna yang sulit membedakan warna.
 */

type Nada = "lunas" | "sebagian" | "tempo" | "netral";

const NADA: Record<Nada, string> = {
  lunas: "border-lunas/30 bg-lunas-halus text-lunas",
  sebagian: "border-sebagian/30 bg-sebagian-halus text-sebagian",
  tempo: "border-tempo/30 bg-tempo-halus text-tempo",
  netral: "border-border-strong/60 bg-muted text-muted-foreground",
};

const STATUS_TAGIHAN: Record<string, { label: string; nada: Nada }> = {
  paid: { label: "Lunas", nada: "lunas" },
  partial: { label: "Sebagian", nada: "sebagian" },
  overdue: { label: "Jatuh Tempo", nada: "tempo" },
  unpaid: { label: "Belum Dibayar", nada: "netral" },
  cancelled: { label: "Dibatalkan", nada: "netral" },
};

const STATUS_PENAWARAN: Record<string, { label: string; nada: Nada }> = {
  approved: { label: "Disetujui", nada: "lunas" },
  sent: { label: "Terkirim", nada: "sebagian" },
  rejected: { label: "Ditolak", nada: "tempo" },
  expired: { label: "Kadaluarsa", nada: "tempo" },
  draft: { label: "Draft", nada: "netral" },
};

function Lencana({ label, nada }: { label: string; nada: Nada }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap",
        NADA[nada],
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          nada === "netral" ? "ring-1 ring-current" : "bg-current",
        )}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

export function StatusTagihan({ status }: { status: string }) {
  const s = STATUS_TAGIHAN[status] ?? { label: status, nada: "netral" as const };
  return <Lencana label={s.label} nada={s.nada} />;
}

export function StatusPenawaran({ status }: { status: string }) {
  const s = STATUS_PENAWARAN[status] ?? { label: status, nada: "netral" as const };
  return <Lencana label={s.label} nada={s.nada} />;
}
