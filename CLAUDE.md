# Proyek SowanQR - Buku Tamu Digital

## Tech Stack
- **Framework:** Next.js 16 (App Router, Turbopack)
- **Styling:** Tailwind CSS
- **Database/Sheet:** Google Sheets API (via `google-spreadsheet` & `google-auth-library`)
- **QR Generator:** `qrcode` (node library)
- **WhatsApp Gateway:** Fonnte API

## Struktur Folder & Keamanan
Berikut adalah panduan direktori agar AI lain dapat memberikan bantuan dengan tepat:

### 1. Folder Utama (Root)
- `.env.local`: **[SANGAT RAHASIA]** Berisi `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, dan `WA_GATEWAY_TOKEN`. *Jangan pernah mengubah atau membagikan isinya.*
- `tailwind.config.js` & `postcss.config.js`: Konfigurasi styling.
- `package.json`: Daftar dependensi proyek.

### 2. Folder `src/app/` (Logic & UI)
- `layout.js`: Kerangka utama website (Wajib memuat `globals.css`).
- `page.js`: Antarmuka utama (Client Component, menggunakan Tailwind).
- `globals.css`: File CSS utama untuk Tailwind.
- `api/booking/route.js`: **[LOGIC UTAMA]** Endpoint API untuk integrasi Google Sheets dan Fonnte.

### 3. Folder `public/`
- Berisi file aset statis (gambar/icon jika ada).

---

## Aturan Bantuan
- **App Router:** Gunakan App Router (`src/app/`) untuk setiap penambahan rute baru.
- **Client/Server Components:** Bedakan penggunaan `'use client'` di `page.js` dan standard *Server Actions/API* di `route.js`.
- **Keamanan:** Jangan pernah meminta untuk menampilkan isi file `.env.local` atau kunci rahasia dalam bentuk teks mentah.