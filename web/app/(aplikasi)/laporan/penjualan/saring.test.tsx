import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* ==========================================================================
   PENYARING LAPORAN TIDAK BOLEH BERPINDAH SELAGI TAHUN DIKETIK

   Isiannya dikendalikan penuh oleh alamat halaman: setiap perubahan
   memindahkan alamatnya, dan isiannya digambar ulang dari alamat yang baru.
   Mengetik tahun "2026" angka demi angka membuat browser melaporkan
   "0002-09-30" begitu angka pertama masuk — halaman berpindah, dan tiga
   angka sisanya tidak pernah sampai.

   Aturannya sendiri diuji di lib/tanggal-saring.test.ts. Yang diuji DI SINI
   adalah bahwa aturan itu benar-benar DIPASANG pada isiannya: aturan yang
   benar tetapi tidak dipanggil tidak menolong siapa pun, dan tidak ada
   galat apa pun yang akan menunjukkannya.
   ========================================================================== */

const gantiAlamat = vi.fn();
let alamat = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: (...a: unknown[]) => gantiAlamat(...a) }),
  usePathname: () => "/laporan/penjualan",
  useSearchParams: () => alamat,
}));

import { SaringLaporan } from "./saring";

beforeEach(() => {
  gantiAlamat.mockReset();
  alamat = new URLSearchParams();
});

afterEach(cleanup);

const pasang = () => render(<SaringLaporan pelanggan={[]} />);

const isiTanggal = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement;

describe("mengetik tahun angka demi angka", () => {
  it("TIDAK memindahkan halaman sebelum tahunnya lengkap", () => {
    pasang();
    const sampai = isiTanggal(/sampai tanggal/i);

    // Persis urutan yang dilaporkan browser.
    for (const nilai of ["0002-09-30", "0020-09-30", "0202-09-30"]) {
      fireEvent.change(sampai, { target: { value: nilai } });
    }

    expect(gantiAlamat, "halaman berpindah selagi tahunnya diketik").not.toHaveBeenCalled();
  });

  it("berpindah sekali, dengan tanggal yang LENGKAP", () => {
    pasang();
    const sampai = isiTanggal(/sampai tanggal/i);

    for (const nilai of ["0002-09-30", "0020-09-30", "0202-09-30", "2026-09-30"]) {
      fireEvent.change(sampai, { target: { value: nilai } });
    }

    expect(gantiAlamat).toHaveBeenCalledTimes(1);
    expect(String(gantiAlamat.mock.calls[0][0])).toContain("sampai=2026-09-30");
  });

  it("berlaku juga untuk isian Dari tanggal", () => {
    pasang();
    const dari = isiTanggal(/dari tanggal/i);

    fireEvent.change(dari, { target: { value: "0002-01-09" } });
    expect(gantiAlamat).not.toHaveBeenCalled();

    fireEvent.change(dari, { target: { value: "2026-01-09" } });
    expect(gantiAlamat).toHaveBeenCalledTimes(1);
  });
});

describe("melepas penyaringnya", () => {
  it("mengosongkan isian tetap memindahkan halaman", () => {
    // Menolak yang kosong akan membuat penyaringnya tidak bisa dihapus
    // selain lewat tombol Reset.
    alamat = new URLSearchParams({ sampai: "2026-09-30" });
    pasang();

    fireEvent.change(isiTanggal(/sampai tanggal/i), { target: { value: "" } });

    expect(gantiAlamat).toHaveBeenCalledTimes(1);
    expect(String(gantiAlamat.mock.calls[0][0])).not.toContain("sampai=");
  });
});
