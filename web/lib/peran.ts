/* ==========================================================================
   DAFTAR PERAN

   Dipisah dari lib/auth.ts yang memasang penjaga "server-only": daftar ini
   juga dibutuhkan layar pemilih peran, dan layar itu berjalan di browser.
   Mengimpornya dari auth.ts akan lolos pemeriksaan tipe lalu menggagalkan
   build — tanpa petunjuk bahwa penyebabnya cuma letak berkas.

   Tidak ada apa pun di sini yang menyentuh database, cookie, atau sandi.
   ========================================================================== */

export const PERAN = ["admin", "sales", "finance", "cost"] as const;
export type Peran = (typeof PERAN)[number];

/** Nama peran sebagaimana ditulis di layar. */
export const LABEL_PERAN: Record<Peran, string> = {
  admin: "Admin",
  sales: "Sales",
  finance: "Finance",
  cost: "Cost",
};
