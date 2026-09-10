import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Folder induk masih berisi aplikasi Laravel lengkap dengan package-lock.json
  // miliknya sendiri. Tanpa penunjuk ini, Next.js mengira akar proyek ada di
  // sana dan menelusuri berkas PHP yang tidak ada hubungannya.
  turbopack: {
    root: path.resolve(__dirname),
  },

  // Paket ini menyimpan mesin kueri asli; biarkan Next.js memuatnya apa adanya
  // di sisi server, jangan dibundel.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg"],
};

export default nextConfig;
