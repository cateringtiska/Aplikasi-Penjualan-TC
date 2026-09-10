# Penjualan TC — aplikasi web

Penulisan ulang aplikasi penjualan katering Tiska dari Laravel ke Next.js.
Kode Laravel yang lama tetap ada di folder induk sebagai pembanding angka.

- **Produksi:** https://penjualan-tc.vercel.app
- **Database:** Supabase PostgreSQL 17 (region Singapore)
- **Deploy:** otomatis setiap `git push` ke branch `main`

## Menjalankan di komputer sendiri

Semua perintah dijalankan dari **Laragon → Terminal**, bukan PowerShell biasa
(Node dan Git hanya ada di dalam Laragon).

```bash
cd C:\laragon\www\aplikasi-penjualan-tc\web
npm install
npm run dev
```

Buka http://localhost:3000.

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Menjalankan aplikasi untuk pengembangan |
| `npm test` | Menjalankan tes perhitungan uang |
| `npm run build` | Membangun versi produksi (dipakai Vercel) |
| `npm run db:tarik` | Membaca ulang struktur tabel dari Supabase |
| `node scripts/cek-koneksi.mjs` | Menguji koneksi database |

## Lima hal yang mudah bikin bingung

**1. Password database mengandung tanda `+`.**
Di dalam URL koneksi, tanda `+` berarti spasi. Harus ditulis `%2B`. Kalau
disalin apa adanya, kegagalannya muncul sebagai "password authentication
failed" — pesan yang menyesatkan, karena passwordnya sebenarnya benar.

**2. Ada DUA URL database, dan portnya berbeda. Jangan tertukar.**

| Variabel | Port | Dipakai oleh | Kenapa |
| --- | --- | --- | --- |
| `DATABASE_URL` | **6543** | Aplikasi | Transaction pooler — koneksi dipulangkan tiap selesai transaksi, sanggup melayani banyak salinan fungsi serverless |
| `DIRECT_DATABASE_URL` | **5432** | Perintah Prisma CLI | Session pooler — migrasi butuh satu koneksi yang bertahan |

Kalau aplikasi memakai port 5432, produksi akan tumbang begitu ada beberapa
pengunjung bersamaan:

```
(EMAXCONNSESSION) max clients reached in session mode
max clients are limited to pool_size: 15
```

Selain portnya, `lib/prisma.ts` juga membatasi `max: 1` koneksi per salinan
fungsi. Tanpa itu, pustaka `pg` membuka sampai 10 koneksi per salinan — tiga
salinan saja sudah melampaui jatah.

**3. `DATABASE_URL` wajib berakhiran `&uselibpqcompat=true`.**
Driver `pg` versi baru memperlakukan `sslmode=require` sebagai `verify-full`,
yaitu ikut memeriksa penerbit sertifikat. Supabase memakai CA sendiri, jadi
tanpa parameter itu koneksi ditolak dengan "self-signed certificate in
certificate chain". Lalu lintas tetap terenkripsi; yang dilewati hanya
verifikasi penerbitnya — sama seperti perilaku `psql` dan Laravel.

Perhatikan: parameter ini **hanya** untuk Prisma/Node. `psql` tidak
mengenalnya dan akan menolak URL yang memuatnya.

**4. Jangan mengisi environment variable Vercel lewat pipe PowerShell.**
Perintah `$nilai | vercel env add NAMA production` memotong nilainya diam-diam.
`DATABASE_URL` sepanjang 151 karakter pernah tersimpan hanya 11 karakter
(`postgresql:`), dan gejalanya sama sekali tidak menunjuk ke sana:
`P1001 Can't reach database server at base`.

Cara yang benar: REST API `POST /v10/projects/{id}/env?upsert=true` dengan
body JSON, lalu **selalu** diperiksa ulang:

```bash
vercel env pull cek.txt --environment=production
# DATABASE_URL harus 151 karakter, AUTH_SECRET harus 44
```

**5. Sandi lama Laravel berawalan `$2y$`.**
Pustaka bcrypt JavaScript hanya mengenali `$2a$` dan `$2b$`. Algoritmanya
sama persis, hanya penanda versinya berbeda. `lib/auth.ts` menyetarakan
keduanya, sehingga akun lama tetap bisa login dengan sandi yang sama.

## Susunan folder

| Folder | Isi |
| --- | --- |
| `app/masuk` | Halaman login |
| `app/(aplikasi)` | Semua halaman yang wajib login |
| `lib/uang.ts` | Rumus service charge, PB1, status bayar, margin |
| `lib/auth.ts` | Login dan sesi |
| `lib/prisma.ts` | Koneksi database — baca komentarnya sebelum mengubah |
| `lib/navigasi.ts` | Menu sekaligus hak akses per peran |
| `prisma/schema.prisma` | Cerminan tabel Supabase — jangan ditulis tangan |

## Perhitungan uang

`lib/uang.ts` adalah terjemahan langsung dari rumus Laravel, dan setiap
rumusnya punya tes di `lib/uang.test.ts`. Jalankan `npm test` sebelum
mengubah apa pun di berkas itu.

Dua hal yang paling sering salah dan sudah dikunci oleh tes:

- **Dasar service charge bukan subtotal.** Hanya baris bertanda kena service
  charge dan bukan compliment yang ikut dihitung.
- **PB1 dihitung dari subtotal**, bukan dari subtotal ditambah service charge.

Semua uang memakai `Decimal`, tidak pernah angka pecahan JavaScript biasa.
Pembulatan meniru `round()` PHP: setengah rupiah dibulatkan menjauhi nol.

## Membuat akun admin

```bash
node scripts/buat-admin.mjs "Nama Lengkap" "email@perusahaan.com"
```

Sandi dibuat acak dan hanya ditampilkan sekali. Pendaftaran mandiri sengaja
tidak ada — akun hanya dibuat admin.
