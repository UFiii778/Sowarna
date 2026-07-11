# 🚀 SowanQR - Sistem Manajemen Kunjungan Tamu Berbasis QR Code (apliaksi di non-aktifkan)

**SowanQR** adalah aplikasi web manajemen kunjungan tamu (Visitor Management System) modern yang dirancang untuk mendigitalisasi proses check-in instansi atau sekolah secara efisien. Dengan memanfaatkan teknologi QR Code, SowanQR memotong jalur birokrasi manual, meningkatkan keamanan area, serta menyajikan sinkronisasi data transaksional yang aman dan cepat secara *real-time*.

---

## ✨ Fitur Utama

1. **Dashboard Tamu (User):** - Pembuatan Token & QR Code Booking secara mandiri berdasarkan keperluan dan orang yang ingin ditemui.
   - Pemantauan status kehadiran (*Pending* ke *Hadir*) secara *real-time* tanpa *refresh* halaman.
   - Integrasi otomatis notifikasi WhatsApp melalui gateway Foonte setelah sukses membuat janji temu.

2. **Dashboard Admin:**
   - Pemindaian QR Code tamu secara langsung untuk validasi kedatangan.
   - Panel pemantauan *real-time* riwayat seluruh kunjungan menggunakan fitur integrasi *Relationalbb JOIN* untuk memetakan NIK ke identitas lengkap profil tamu.

3. **Sinkronisasi Data Otomatis:**
   - Sistem penyimpanan ganda (*Dual-storage architecture*) yang mengamankan data transaksional di database utama (Supabase) sekaligus mengarsipkannya secara otomatis ke Google Sheets untuk kebutuhan pelaporan administratif.

---

## 🛠️ Tech Stack & Fungsi Komponen

Aplikasi ini dibangun menggunakan kombinasi teknologi modern berskala produksi untuk menjamin performa, keamanan, dan pengalaman pengguna yang responsif:

| Komponen / Library | Deskripsi Fungsi | URL Dokumentasi Resmi |
| :--- | :--- | :--- |
| **Next.js (App Router)** | *Framework* React utama untuk kebutuhan rendering sisi server (SSR) maupun klien (CSR) secara hibrida serta manajemen API internal. | [nextjs.org/docs](https://nextjs.org/docs) |
| **Supabase Database** | Database PostgreSQL utama untuk menyimpan tabel relasional master (`profil_tamu`) dan data transaksional (`kunjungan_tamu`). | [supabase.com/docs](https://supabase.com/docs) |
| **Supabase Realtime** | Mengelola *Postgres Changes Listener* menggunakan pola pub/sub melalui `supabase.channel` untuk memperbarui status UI secara instan. | [supabase.com/docs/guides/realtime](https://supabase.com/docs/guides/realtime) |
| **Tailwind CSS** | *Framework* CSS berbasis utilitas untuk menyusun antarmuka dasbor yang responsif, modern, dan bersih (*clean look*). | [tailwindcss.com/docs](https://tailwindcss.com/docs) |
| **Foonte API** | Gateway API pihak ketiga yang menangani pengiriman pesan notifikasi WhatsApp otomatis ke nomor tamu saat pembuatan QR baru berhasil. | [foonte.com/developer](https://foonte.com/developer) |
| **Google Sheets API** | Digunakan pada sisi *backend API route* Next.js melalui autentikasi *Service Account* (`JWT Bearer`) untuk menulis cadangan log kunjungan secara terpusat. | [developers.google.com/sheets/api](https://developers.google.com/sheets/api) |
| **node-qrcode** | Pustaka utilitas untuk mengonversi kode token booking acak menjadi format gambar *Base64 Data URL* secara dinamis di sisi klien. | [npmjs.com/package/qrcode](https://npmjs.com/package/qrcode) |

---

## 📂 Struktur Database (Supabase)

Sistem database dirancang terpisah menggunakan prinsip normalisasi untuk menjaga integritas data:

* **`profil_tamu` (Master Data):** Menyimpan data statis identitas tamu seperti `nik` *(Primary Key)*, `nama`, `instansi`, `whatsapp`, dan `email`.
* **`kunjungan_tamu` (Data Transaksional):** Menyimpan riwayat aktivitas seperti `id`, `nik` *(Foreign Key -> profil_tamu.nik)*, `keperluan`, `menemui`, `kode`, `status`, dan `waktu_hadir`.

---

## 🚀 Alur Kerja Aplikasi

1. **Booking:** Tamu mengisi formulir kunjungan ➡️ Sistem membuat kode token unik dan merendernya menjadi QR Code ➡️ Data dikirim ke Supabase ➡️ API Backend memicu pencatatan baris baru di **Google Sheets** dan mengirimkan pesan konfirmasi **WhatsApp via Foonte**.
2. **Check-In:** Tamu menunjukkan QR Code kepada petugas ➡️ Admin memindai QR Code ➡️ Status di Supabase berubah menjadi `Hadir` ➡️ Dashboard Tamu dan Admin ter-update secara otomatis secara **Real-time** tanpa perlu melakukan *reload* halaman.
