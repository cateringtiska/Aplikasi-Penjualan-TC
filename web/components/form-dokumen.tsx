"use client";

import { CornerDownRight, LoaderCircle, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { jumlahHariAcara } from "@/lib/tanggal";
import { d, hitungTotalDokumen, rupiah, subtotalBaris, uraikanRupiah } from "@/lib/uang";

import type { KeadaanDokumen } from "@/lib/dokumen";

export type PilihanPelanggan = {
  id: string;
  nama: string;
  kode: string;
  contact_person: string | null;
  phone: string | null;
};

export type PilihanProduk = {
  id: string;
  nama: string;
  unit: string;
  harga: string;
};

export type IsiAwal = {
  id?: string;
  customer_id: string;
  contact_person: string;
  contact_phone: string;
  tanggal: string;
  tanggal_akhir: string;
  event_dates: BarisTanggalForm[];
  event_type: string;
  event_time: string;
  guest_count: string;
  fnb_planner: string;
  venue: string;
  notes: string;
  service_charge_percent: string;
  delivery_amount: string;
  biaya_tambahan: BarisTambahanForm[];
  pb1_enabled: boolean;
  pb1_percent: string;
  show_payment_terms: boolean;
  payment_terms: string;
  items: BarisForm[];
};

export type BarisForm = {
  kunci: string;
  product_id: string;
  /** Berapa hari baris ini disajikan. Kosong berarti satu. */
  day: string;
  item_name: string;
  unit: string;
  qty: string;
  price: string;
  is_compliment: boolean;
  charge_service: boolean;
  charge_pb1: boolean;
  children: { kunci: string; item_name: string; unit: string; qty: string; price: string }[];
};

/**
 * Satu baris biaya tambahan bernama, di luar service charge dan PB1 —
 * "Tim Servis utk Menu Buffet (1 orang)", "Tambahan Set-up & Layanan 1 Titik
 * VIP Buffet", dan seterusnya.
 */
export type BarisTambahanForm = {
  kunci: string;
  label: string;
  amount: string;
};

export function tambahanKosong(): BarisTambahanForm {
  return { kunci: crypto.randomUUID(), label: "", amount: "" };
}

/** Satu tanggal acara. Kuncinya supaya baris tidak berpindah saat dihapus. */
export type BarisTanggalForm = { kunci: string; tanggal: string };

export function tanggalKosong(tanggal = ""): BarisTanggalForm {
  return { kunci: crypto.randomUUID(), tanggal };
}

export function barisKosong(): BarisForm {
  return {
    kunci: crypto.randomUUID(),
    product_id: "",
    item_name: "",
    unit: "",
    day: "1",
    qty: "1",
    price: "",
    is_compliment: false,
    charge_service: true,
    charge_pb1: true,
    children: [],
  };
}

const keadaanAwal: KeadaanDokumen = {};

/**
 * Kata-kata yang berbeda antara penawaran dan tagihan. Selain ini, kedua
 * formulir memang benar-benar sama — struktur item, service charge, PB1,
 * dan syarat pembayarannya identik.
 */
export type IstilahDokumen = {
  /** "penawaran" atau "tagihan" — dipakai di dalam kalimat. */
  kata: string;
  labelTanggal: string;
  labelTanggalAkhir: string;
  tombolSimpan: string;
  batalHref: string;
};

export function FormDokumen({
  isiAwal,
  pelanggan,
  produk,
  aksi,
  istilah,
  medanTambahan,
}: {
  isiAwal: IsiAwal;
  pelanggan: PilihanPelanggan[];
  produk: PilihanProduk[];
  aksi: (
    sebelumnya: KeadaanDokumen,
    data: FormData,
  ) => Promise<KeadaanDokumen>;
  istilah: IstilahDokumen;
  /** Nilai tersembunyi yang ikut terkirim, misalnya asal penawaran. */
  medanTambahan?: Record<string, string>;
}) {
  const [keadaan, kirim, sedangKirim] = useActionState(aksi, keadaanAwal);

  // Formulir tidak pernah dibuka dalam keadaan tanpa baris sama sekali —
  // baris kosong pertama disiapkan di sini supaya halaman baru langsung
  // bisa diketik tanpa menekan "Tambah baris" lebih dulu.
  const [f, setF] = useState<IsiAwal>(() => ({
    ...isiAwal,
    items: isiAwal.items.length > 0 ? isiAwal.items : [barisKosong()],
  }));

  function ubah<K extends keyof IsiAwal>(kunci: K, nilai: IsiAwal[K]) {
    setF((lama) => ({ ...lama, [kunci]: nilai }));
  }

  function ubahBaris(index: number, perubahan: Partial<BarisForm>) {
    setF((lama) => ({
      ...lama,
      items: lama.items.map((b, i) => (i === index ? { ...b, ...perubahan } : b)),
    }));
  }

  function ubahTanggal(index: number, tanggal: string) {
    setF((lama) => ({
      ...lama,
      event_dates: lama.event_dates.map((b, i) => (i === index ? { ...b, tanggal } : b)),
    }));
  }

  function ubahTambahan(index: number, perubahan: Partial<BarisTambahanForm>) {
    setF((lama) => ({
      ...lama,
      biaya_tambahan: lama.biaya_tambahan.map((b, i) =>
        i === index ? { ...b, ...perubahan } : b,
      ),
    }));
  }

  function pilihProduk(index: number, idProduk: string) {
    const p = produk.find((x) => x.id === idProduk);
    ubahBaris(index, {
      product_id: idProduk,
      ...(p
        ? {
            item_name: p.nama,
            unit: p.unit,
            price: Number(p.harga).toLocaleString("id-ID"),
          }
        : {}),
    });
  }

  // Total dihitung ulang setiap ketikan memakai rumus yang sama persis dengan
  // yang dipakai server. Angka ini hanya untuk dilihat — yang disimpan tetap
  // hasil hitungan server.
  const total = useMemo(
    () =>
      hitungTotalDokumen({
        items: f.items.map((b) => ({
          day: uraikanRupiah(b.day) ?? 1,
          qty: uraikanRupiah(b.qty) ?? 0,
          price: uraikanRupiah(b.price) ?? 0,
          is_compliment: b.is_compliment,
          charge_service: b.charge_service,
          charge_pb1: b.charge_pb1,
          children: b.children.map((a) => ({
            qty: uraikanRupiah(a.qty) ?? 0,
            price: uraikanRupiah(a.price) ?? 0,
          })),
        })),
        service_charge_percent: f.service_charge_percent || null,
        pb1_enabled: f.pb1_enabled,
        pb1_percent: f.pb1_percent || 10,
        delivery_amount: uraikanRupiah(f.delivery_amount) ?? 0,
        biaya_tambahan: f.biaya_tambahan.map((b) => ({
          label: b.label,
          amount: uraikanRupiah(b.amount) ?? 0,
        })),
      }),
    [
      f.items,
      f.service_charge_percent,
      f.pb1_enabled,
      f.pb1_percent,
      f.delivery_amount,
      f.biaya_tambahan,
    ],
  );

  // Dihitung dengan aturan yang sama persis dengan yang dipakai server,
  // supaya angka di layar tidak pernah berbeda dari yang tersimpan.
  const jumlahHari = useMemo(
    () =>
      jumlahHariAcara(
        f.event_dates
          .map((b) => (b.tanggal ? new Date(b.tanggal) : null))
          .filter((x): x is Date => x !== null && !Number.isNaN(x.getTime())),
      ),
    [f.event_dates],
  );

  const muatan = JSON.stringify({
    id: f.id ?? null,
    customer_id: f.customer_id,
    contact_person: f.contact_person,
    contact_phone: f.contact_phone,
    tanggal: f.tanggal,
    tanggal_akhir: f.tanggal_akhir,
    event_dates: f.event_dates.map((b) => b.tanggal).filter((s) => s !== ""),
    event_type: f.event_type,
    event_time: f.event_time,
    guest_count: f.guest_count || null,
    fnb_planner: f.fnb_planner,
    venue: f.venue,
    notes: f.notes,
    service_charge_percent: f.service_charge_percent || null,
    delivery_amount: f.delivery_amount || null,
    biaya_tambahan: f.biaya_tambahan.map((b) => ({
      label: b.label,
      amount: b.amount,
    })),
    pb1_enabled: f.pb1_enabled,
    pb1_percent: f.pb1_percent || null,
    show_payment_terms: f.show_payment_terms,
    payment_terms: f.payment_terms,
    items: f.items.map((b) => ({
      product_id: b.product_id || null,
      day: b.day,
      item_name: b.item_name,
      unit: b.unit || null,
      qty: b.qty,
      price: b.price,
      is_compliment: b.is_compliment,
      charge_service: b.charge_service,
      charge_pb1: b.charge_pb1,
      children: b.children.map((a) => ({
        item_name: a.item_name,
        unit: a.unit || null,
        qty: a.qty,
        price: a.price,
      })),
    })),
  });

  return (
    <form action={kirim} className="flex flex-col gap-8 pb-28">
      <input type="hidden" name="muatan" value={muatan} />
      {Object.entries(medanTambahan ?? {}).map(([nama, nilai]) => (
        <input key={nama} type="hidden" name={nama} value={nilai} />
      ))}

      {keadaan.pesan ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/25 bg-destructive/5 px-3.5 py-3 text-sm text-destructive"
        >
          {keadaan.pesan}
        </p>
      ) : null}

      {/* ---------- Pelanggan & tanggal ---------- */}
      <Bagian judul="Customer" keterangan={`Kepada siapa ${istilah.kata} ini ditujukan.`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Bidang label="Customer" nama="customer_id" galat={keadaan.galat?.customer_id} wajib>
            <select
              id="customer_id"
              value={f.customer_id}
              onChange={(e) => {
                const dipilih = pelanggan.find((x) => x.id === e.target.value);

                setF((lama) => {
                  const sebelumnya = pelanggan.find((x) => x.id === lama.customer_id);

                  /* Mengganti customer harus ikut mengganti kontaknya —
                     sebelumnya tidak, karena kolomnya hanya diisi kalau masih
                     kosong, sehingga kontak customer PERTAMA menempel terus.
                     Tetapi ketikan sendiri juga tidak boleh hilang: sebuah
                     acara bisa saja ditangani orang lain, bukan PIC yang
                     tercatat di data customer.
                     Pembedanya: isian yang masih sama persis dengan bawaan
                     customer sebelumnya berarti belum disentuh siapa pun. */
                  const ikut = (
                    sekarang: string,
                    bawaanLama: string | null | undefined,
                    bawaanBaru: string | null | undefined,
                  ) =>
                    sekarang === "" || sekarang === (bawaanLama ?? "")
                      ? (bawaanBaru ?? "")
                      : sekarang;

                  return {
                    ...lama,
                    customer_id: e.target.value,
                    contact_person: ikut(
                      lama.contact_person,
                      sebelumnya?.contact_person,
                      dipilih?.contact_person,
                    ),
                    contact_phone: ikut(
                      lama.contact_phone,
                      sebelumnya?.phone,
                      dipilih?.phone,
                    ),
                  };
                });
              }}
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <option value="">— Pilih customer —</option>
              {pelanggan.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama} ({p.kode})
                </option>
              ))}
            </select>
          </Bidang>

          <div className="grid gap-4 sm:grid-cols-2">
            <Bidang label="Nama kontak" nama="contact_person">
              <Input
                id="contact_person"
                value={f.contact_person}
                onChange={(e) => ubah("contact_person", e.target.value)}
                placeholder="Ibu Sari"
              />
            </Bidang>
            <Bidang label="Telepon" nama="contact_phone">
              <Input
                id="contact_phone"
                value={f.contact_phone}
                onChange={(e) => ubah("contact_phone", e.target.value)}
                placeholder="0812…"
              />
            </Bidang>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Bidang label={istilah.labelTanggal} nama="tanggal" wajib>
            <Input
              id="tanggal"
              type="date"
              value={f.tanggal}
              onChange={(e) => ubah("tanggal", e.target.value)}
            />
          </Bidang>
          <Bidang
            label={istilah.labelTanggalAkhir}
            nama="tanggal_akhir"
            galat={keadaan.galat?.tanggal_akhir}
            wajib
          >
            <Input
              id="tanggal_akhir"
              type="date"
              value={f.tanggal_akhir}
              onChange={(e) => ubah("tanggal_akhir", e.target.value)}
              aria-invalid={Boolean(keadaan.galat?.tanggal_akhir)}
            />
          </Bidang>
        </div>
      </Bagian>

      {/* ---------- Detail acara ---------- */}
      <Bagian
        judul="Detail acara"
        keterangan="Dicetak di kepala dokumen. Boleh dikosongkan."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Bidang
            label="Tanggal acara"
            nama="event_dates"
            galat={keadaan.galat?.event_dates}
          >
            <div className="flex flex-col gap-2">
              {f.event_dates.map((baris, i) => (
                <div key={baris.kunci} className="flex items-center gap-2">
                  <Input
                    id={i === 0 ? "event_dates" : undefined}
                    type="date"
                    value={baris.tanggal}
                    onChange={(e) => ubahTanggal(i, e.target.value)}
                    aria-label={`Tanggal acara ke-${i + 1}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      ubah("event_dates", f.event_dates.filter((_, y) => y !== i))
                    }
                    aria-label={`Hapus tanggal acara ke-${i + 1}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => ubah("event_dates", [...f.event_dates, tanggalKosong()])}
              >
                <Plus className="size-4" />
                Tambah tanggal
              </Button>
            </div>
          </Bidang>

          {/* Jumlah hari DIHITUNG, tidak diketik. Diketik terpisah, ia bisa
              berbeda dari tanggalnya — dan dokumen yang menyebut "3 hari"
              dengan dua tanggal tercetak tidak akan ditegur siapa pun. */}
          <Bidang label="Jumlah hari" nama="event_days">
            <p className="flex h-9 items-center text-sm">
              {jumlahHari > 0 ? (
                <span>
                  {jumlahHari} hari{" "}
                  <span className="text-muted-foreground">· dihitung dari tanggalnya</span>
                </span>
              ) : (
                <span className="text-muted-foreground">Belum ada tanggal</span>
              )}
            </p>
          </Bidang>
          <Bidang label="Jam" nama="event_time">
            <Input
              id="event_time"
              value={f.event_time}
              onChange={(e) => ubah("event_time", e.target.value)}
              placeholder="11.00 – 14.00"
            />
          </Bidang>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Bidang label="Jenis acara" nama="event_type">
            <Input
              id="event_type"
              value={f.event_type}
              onChange={(e) => ubah("event_type", e.target.value)}
              placeholder="Resepsi pernikahan"
            />
          </Bidang>
          <Bidang label="Jumlah tamu" nama="guest_count">
            <Input
              id="guest_count"
              inputMode="numeric"
              value={f.guest_count}
              onChange={(e) => ubah("guest_count", e.target.value)}
              placeholder="300"
            />
          </Bidang>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Bidang label="Venue" nama="venue">
            <Input
              id="venue"
              value={f.venue}
              onChange={(e) => ubah("venue", e.target.value)}
              placeholder="Gedung Serbaguna"
            />
          </Bidang>
          <Bidang label="F&B planner" nama="fnb_planner">
            <Input
              id="fnb_planner"
              value={f.fnb_planner}
              onChange={(e) => ubah("fnb_planner", e.target.value)}
            />
          </Bidang>
        </div>
      </Bagian>

      {/* ---------- Item ---------- */}
      <Bagian
        judul={`Rincian ${istilah.kata}`}
        keterangan="Sub-item tanpa harga merinci isi paket. Begitu sub-itemnya diberi jumlah dan harga, baris induknya jadi judul kelompok dan kolom angkanya boleh dikosongkan."
      >
        {keadaan.galat?.items ? (
          <p role="alert" className="text-sm text-destructive">
            {keadaan.galat.items}
          </p>
        ) : null}

        <ul className="flex flex-col gap-3">
          {f.items.map((b, i) => (
            <BarisItem
              key={b.kunci}
              baris={b}
              nomor={i + 1}
              produk={produk}
              bisaHapus={f.items.length > 1}
              onUbah={(perubahan) => ubahBaris(i, perubahan)}
              onPilihProduk={(id) => pilihProduk(i, id)}
              onHapus={() =>
                setF((lama) => ({ ...lama, items: lama.items.filter((_, x) => x !== i) }))
              }
            />
          ))}
        </ul>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setF((lama) => ({ ...lama, items: [...lama.items, barisKosong()] }))}
        >
          <Plus className="size-4" />
          Tambah baris
        </Button>
      </Bagian>

      {/* ---------- Biaya tambahan ---------- */}
      <Bagian
        judul="Service charge, pajak & pengantaran"
        keterangan="Service charge dan PB1 masing-masing hanya dihitung dari baris yang ditandai."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Bidang label="Service charge (%)" nama="service_charge_percent">
            <Input
              id="service_charge_percent"
              inputMode="decimal"
              value={f.service_charge_percent}
              onChange={(e) => ubah("service_charge_percent", e.target.value)}
              placeholder="5"
              className="angka tabular-nums"
            />
            <p className="text-xs text-muted-foreground">
              Dasar perhitungan: {rupiah(total.dasar_service_charge)}
            </p>
          </Bidang>

          <div className="flex flex-col gap-2">
            <Label htmlFor="pb1_enabled">PB1</Label>
            <label className="flex h-9 cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox
                id="pb1_enabled"
                checked={f.pb1_enabled}
                onCheckedChange={(v) => ubah("pb1_enabled", v === true)}
              />
              Kenakan PB1
            </label>
            {f.pb1_enabled ? (
              <>
                <Input
                  inputMode="decimal"
                  value={f.pb1_percent}
                  onChange={(e) => ubah("pb1_percent", e.target.value)}
                  placeholder="10"
                  aria-label="Persen PB1"
                  className="angka tabular-nums"
                />
                <p className="text-xs text-muted-foreground">
                  Dasar perhitungan: {rupiah(total.dasar_pb1)}
                </p>
              </>
            ) : null}
          </div>

          <Bidang
            label="Delivery (Rp)"
            nama="delivery_amount"
            galat={keadaan.galat?.delivery_amount}
          >
            <Input
              id="delivery_amount"
              inputMode="numeric"
              value={f.delivery_amount}
              onChange={(e) => ubah("delivery_amount", e.target.value)}
              placeholder="0"
              className="angka tabular-nums"
            />
            <p className="text-xs text-muted-foreground">
              Di luar service charge dan PB1 — ongkos kirim, bukan nilai makanan.
            </p>
          </Bidang>
        </div>
      </Bagian>

      {/* ---------- Biaya tambahan bernama ---------- */}
      <Bagian
        judul="Biaya tambahan"
        keterangan="Di luar service charge dan PB1, sama seperti delivery. Namanya bebas — misalnya “Tim Servis utk Menu Buffet (1 orang)”. Isi dengan angka minus untuk potongan atau pembulatan, misalnya -65.000."
      >
        {keadaan.galat?.biaya_tambahan ? (
          <p className="text-sm text-destructive">{keadaan.galat.biaya_tambahan}</p>
        ) : null}

        {f.biaya_tambahan.length > 0 ? (
          <ul className="flex flex-col gap-2.5">
            {f.biaya_tambahan.map((b, i) => (
              <li key={b.kunci} className="flex items-center gap-2">
                <Input
                  value={b.label}
                  onChange={(e) => ubahTambahan(i, { label: e.target.value })}
                  placeholder="Nama biaya"
                  aria-label={`Nama biaya tambahan ${i + 1}`}
                  className="flex-1"
                />
                <Input
                  inputMode="numeric"
                  value={b.amount}
                  onChange={(e) => ubahTambahan(i, { amount: e.target.value })}
                  placeholder="0"
                  aria-label={`Jumlah biaya tambahan ${i + 1}`}
                  className="angka w-40 shrink-0 text-right tabular-nums"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    ubah(
                      "biaya_tambahan",
                      f.biaya_tambahan.filter((_, y) => y !== i),
                    )
                  }
                  aria-label={`Hapus biaya tambahan ${i + 1}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Belum ada biaya tambahan.</p>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => ubah("biaya_tambahan", [...f.biaya_tambahan, tambahanKosong()])}
        >
          <Plus className="size-4" />
          Tambah biaya
        </Button>
      </Bagian>

      {/* ---------- Syarat & catatan ---------- */}
      <Bagian judul="Syarat pembayaran & catatan">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <Checkbox
            id="show_payment_terms"
            checked={f.show_payment_terms}
            onCheckedChange={(v) => ubah("show_payment_terms", v === true)}
          />
          Cetak syarat pembayaran di dokumen
        </label>

        {f.show_payment_terms ? (
          <Bidang label="Syarat pembayaran" nama="payment_terms">
            <Textarea
              id="payment_terms"
              rows={4}
              value={f.payment_terms}
              onChange={(e) => ubah("payment_terms", e.target.value)}
              placeholder="Uang muka 50% saat pemesanan, pelunasan H-3 acara."
            />
          </Bidang>
        ) : null}

        <Bidang label="Catatan" nama="notes">
          <Textarea
            id="notes"
            rows={3}
            value={f.notes}
            onChange={(e) => ubah("notes", e.target.value)}
            placeholder="Catatan tambahan untuk customer"
          />
        </Bidang>
      </Bagian>

      {/* ---------- Bilah total yang menempel di bawah ---------- */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-3 sm:px-8">
          <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
            <Angka label="Subtotal" nilai={rupiah(total.subtotal)} />
            {total.service_charge_amount.gt(0) ? (
              <Angka label="Service" nilai={rupiah(total.service_charge_amount)} />
            ) : null}
            {total.pb1_amount.gt(0) ? (
              <Angka label="PB1" nilai={rupiah(total.pb1_amount)} />
            ) : null}
            {total.delivery_amount.gt(0) ? (
              <Angka label="Delivery" nilai={rupiah(total.delivery_amount)} />
            ) : null}
            {!total.biaya_tambahan_amount.isZero() ? (
              <Angka label="Tambahan" nilai={rupiah(total.biaya_tambahan_amount)} />
            ) : null}
            <Angka label="Total" nilai={rupiah(total.grand_total)} tebal />
          </dl>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" render={<Link href={istilah.batalHref} />}>
              Batal
            </Button>
            <Button type="submit" disabled={sedangKirim}>
              {sedangKirim ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                  Menyimpan…
                </>
              ) : (
                istilah.tombolSimpan
              )}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------
   Satu baris item, lengkap dengan sub-itemnya
   ------------------------------------------------------------------------- */

function BarisItem({
  baris,
  nomor,
  produk,
  bisaHapus,
  onUbah,
  onPilihProduk,
  onHapus,
}: {
  baris: BarisForm;
  nomor: number;
  produk: PilihanProduk[];
  bisaHapus: boolean;
  onUbah: (perubahan: Partial<BarisForm>) => void;
  onPilihProduk: (id: string) => void;
  onHapus: () => void;
}) {
  const nilai = subtotalBaris({
    day: uraikanRupiah(baris.day) ?? 1,
    qty: uraikanRupiah(baris.qty) ?? 0,
    price: uraikanRupiah(baris.price) ?? 0,
    is_compliment: baris.is_compliment,
  });

  /** Mengubah satu sub-item tanpa menyentuh saudaranya. */
  function ubahAnak(j: number, ubahan: Partial<BarisForm["children"][number]>) {
    onUbah({
      children: baris.children.map((x, y) => (y === j ? { ...x, ...ubahan } : x)),
    });
  }

  return (
    <li className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3 pb-3">
        <span className="eyebrow pt-1.5">Baris {nomor}</span>
        {bisaHapus ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            onClick={onHapus}
            aria-label={`Hapus baris ${nomor}`}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-12">
        <div className="sm:col-span-4">
          <Label className="sr-only" htmlFor={`nama-${baris.kunci}`}>
            Nama item
          </Label>
          <select
            value={baris.product_id}
            onChange={(e) => onPilihProduk(e.target.value)}
            aria-label={`Ambil dari katalog untuk baris ${nomor}`}
            className="mb-2 h-8 w-full rounded-md border bg-transparent px-2 text-xs text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <option value="">— Ambil dari katalog product —</option>
            {produk.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nama}
              </option>
            ))}
          </select>
          <Input
            id={`nama-${baris.kunci}`}
            value={baris.item_name}
            onChange={(e) => onUbah({ item_name: e.target.value })}
            placeholder="Nama item"
          />
        </div>

        {/* Hari x Jumlah x Harga. Dipisah, bukan dikalikan sendiri oleh
            yang mengetik: dokumen yang menulis "390 box" menghilangkan
            keterangan 130 per hari selama tiga hari — dan angka itulah yang
            dipakai dapur menyiapkannya. */}
        <div className="sm:col-span-1">
          <Label className="sr-only" htmlFor={`hari-${baris.kunci}`}>
            Jumlah hari
          </Label>
          <Input
            id={`hari-${baris.kunci}`}
            inputMode="decimal"
            value={baris.day}
            onChange={(e) => onUbah({ day: e.target.value })}
            placeholder="Hari"
            aria-label={`Jumlah hari baris ${nomor}`}
            className="angka tabular-nums"
          />
          <p className="mt-1 text-center text-[0.6875rem] text-muted-foreground">hari</p>
        </div>

        <div className="sm:col-span-2">
          <Label className="sr-only" htmlFor={`qty-${baris.kunci}`}>
            Jumlah
          </Label>
          <Input
            id={`qty-${baris.kunci}`}
            inputMode="decimal"
            value={baris.qty}
            onChange={(e) => onUbah({ qty: e.target.value })}
            placeholder="Jumlah"
            className="angka tabular-nums"
          />
          <Input
            value={baris.unit}
            onChange={(e) => onUbah({ unit: e.target.value })}
            placeholder="satuan"
            aria-label={`Satuan baris ${nomor}`}
            className="mt-2 h-8 text-xs"
          />
        </div>

        <div className="sm:col-span-3">
          <Label className="sr-only" htmlFor={`harga-${baris.kunci}`}>
            Harga satuan
          </Label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
              Rp
            </span>
            <Input
              id={`harga-${baris.kunci}`}
              inputMode="numeric"
              value={baris.price}
              onChange={(e) => onUbah({ price: e.target.value })}
              placeholder="0"
              className="angka pl-9 tabular-nums"
            />
          </div>
        </div>

        <div className="flex items-center justify-end sm:col-span-2">
          <span
            className={`angka text-sm font-medium tabular-nums ${
              baris.is_compliment ? "text-muted-foreground line-through" : ""
            }`}
          >
            {rupiah(nilai)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-3">
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <Checkbox
            checked={baris.charge_service}
            onCheckedChange={(v) => onUbah({ charge_service: v === true })}
          />
          Kena service charge
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <Checkbox
            checked={baris.charge_pb1}
            onCheckedChange={(v) => onUbah({ charge_pb1: v === true })}
          />
          Kena PB1
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <Checkbox
            checked={baris.is_compliment}
            onCheckedChange={(v) => onUbah({ is_compliment: v === true })}
          />
          Compliment (dihitung nol)
        </label>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto h-7 text-xs"
          onClick={() =>
            onUbah({
              children: [
                ...baris.children,
                { kunci: crypto.randomUUID(), item_name: "", unit: "", qty: "", price: "" },
              ],
            })
          }
        >
          <CornerDownRight className="size-3.5" />
          Sub-item
        </Button>
      </div>

      {baris.children.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2 border-l-2 pl-4">
          {baris.children.map((anak, j) => (
            <li key={anak.kunci} className="flex flex-wrap items-center gap-2">
              <Input
                value={anak.item_name}
                onChange={(e) => ubahAnak(j, { item_name: e.target.value })}
                placeholder="Rincian isi paket"
                aria-label={`Sub-item ${j + 1} pada baris ${nomor}`}
                className="h-8 min-w-40 flex-1 text-sm"
              />
              {/* Jumlah dan harga boleh dikosongkan: sub-item yang sekadar
                  merinci isi paket tidak punya angkanya sendiri. Yang diisi
                  akan ikut dijumlahkan ke subtotal dokumen. */}
              <Input
                value={anak.qty}
                onChange={(e) => ubahAnak(j, { qty: e.target.value })}
                inputMode="numeric"
                placeholder="Jml"
                aria-label={`Jumlah sub-item ${j + 1} pada baris ${nomor}`}
                className="angka h-8 w-20 text-sm tabular-nums"
              />
              <Input
                value={anak.unit}
                onChange={(e) => ubahAnak(j, { unit: e.target.value })}
                placeholder="Satuan"
                aria-label={`Satuan sub-item ${j + 1} pada baris ${nomor}`}
                className="h-8 w-24 text-sm"
              />
              <Input
                value={anak.price}
                onChange={(e) => ubahAnak(j, { price: e.target.value })}
                inputMode="numeric"
                placeholder="Harga"
                aria-label={`Harga sub-item ${j + 1} pada baris ${nomor}`}
                className="angka h-8 w-28 text-sm tabular-nums"
              />
              <span className="angka w-28 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {rupiah(
                  (uraikanRupiah(anak.qty) ?? d(0)).times(uraikanRupiah(anak.price) ?? d(0)),
                )}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() =>
                  onUbah({ children: baris.children.filter((_, y) => y !== j) })
                }
                aria-label={`Hapus sub-item ${j + 1}`}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/* ------------------------------------------------------------------------- */

function Bagian({
  judul,
  keterangan,
  children,
}: {
  judul: string;
  keterangan?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold tracking-[-0.01em]">{judul}</h2>
        {keterangan ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{keterangan}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Bidang({
  label,
  nama,
  galat,
  wajib,
  children,
}: {
  label: string;
  nama: string;
  galat?: string;
  wajib?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={nama}>
        {label}
        {wajib ? <span className="text-muted-foreground"> *</span> : null}
      </Label>
      {children}
      {galat ? <p className="text-xs text-destructive">{galat}</p> : null}
    </div>
  );
}

function Angka({ label, nilai, tebal }: { label: string; nilai: string; tebal?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`angka tabular-nums ${tebal ? "text-base font-semibold" : "text-sm"}`}>
        {nilai}
      </dd>
    </div>
  );
}
