"use client";

import { useEffect } from "react";

/* ==========================================================================
   LATAR BERNUANSA LOGO, YANG BERGESER SAAT DIGULIR

   Warnanya diambil dari piksel logo Tiska sendiri: ornamennya teal pucat,
   huruf T dan tulisannya emas. Di bagian atas halaman latarnya condong ke
   krem keemasan; makin ke bawah bergeser ke teal.

   DIBUAT SANGAT TIPIS, dan itu disengaja. Halaman ini penuh angka, dan satu
   baris "Jatuh Tempo" berwarna merah harus tetap menjadi hal paling
   menonjol di layar. Latar yang ikut berteriak membuat penanda status uang
   kehilangan artinya — dan itulah satu-satunya warna yang benar-benar harus
   terlihat di sini.

   Nilai gulirannya ditulis sebagai variabel CSS, bukan sebagai keadaan
   React: menggambar ulang seluruh halaman pada setiap piksel guliran akan
   membuat tabel panjang tersendat.
   ========================================================================== */

export function LatarMerek() {
  useEffect(() => {
    let menunggu = false;

    const hitung = () => {
      menunggu = false;

      const tinggi = document.documentElement.scrollHeight - window.innerHeight;
      // Halaman yang tidak bisa digulir tetap di nuansa awalnya, bukan
      // dibagi nol.
      const maju = tinggi > 0 ? Math.min(1, Math.max(0, window.scrollY / tinggi)) : 0;

      document.documentElement.style.setProperty("--gulir", maju.toFixed(3));
    };

    const pada = () => {
      if (menunggu) return;
      menunggu = true;
      window.requestAnimationFrame(hitung);
    };

    hitung();
    window.addEventListener("scroll", pada, { passive: true });
    window.addEventListener("resize", pada);

    return () => {
      window.removeEventListener("scroll", pada);
      window.removeEventListener("resize", pada);
    };
  }, []);

  return null;
}

/**
 * Logo Tiska di sudut kanan atas.
 *
 * Ditaruh DI BELAKANG isi halaman, bukan di atasnya: sudut kanan atas
 * adalah tempat tombol "Buat invoice" dan "Buat quotation" berada, dan
 * logo yang menutupinya akan membuat tombol itu tidak bisa ditekan — tanpa
 * galat apa pun, hanya tombol yang tiba-tiba tidak menanggapi.
 *
 * Tidak ikut tercetak: dokumen cetak punya kop logonya sendiri.
 */
export function LogoSudut({ tautan }: { tautan: string | null }) {
  if (!tautan) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 right-0 z-0 hidden select-none p-4 opacity-[0.13] sm:block print:hidden"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={tautan} alt="" className="h-28 w-auto" />
    </div>
  );
}
