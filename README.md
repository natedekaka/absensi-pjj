# 📸 Absensi PJJ

Aplikasi absensi siswa untuk PJJ (Pendidikan Jarak Jauh) — siswa mengisi NIS, Nama Lengkap, Kelas, dan mengunggah foto diri. Foto tersimpan di Google Drive, data absensi di Google Sheet, dan siswa dapat melihat koleksi foto absensinya.

## 📁 Struktur Proyek

| File | Fungsi |
|---|---|
| `index.html` | Halaman form absensi (NIS, Nama Lengkap, Kelas, Foto) |
| `kolase.html` | Halaman koleksi foto absensi per NIS + ekspor CSV |
| `style.css` | Styling responsif (mobile-friendly) |
| `app.js` | Logika frontend: kompresi foto, kirim/ambil data, ekspor CSV |
| `Code.gs` | Backend Google Apps Script (doPost & doGet) |

## ⚙️ Cara Setup

### 1. Siapkan Google Sheet
Buat Google Sheet baru dengan header kolom berikut di baris 1:

```
A: Timestamp | B: NIS | C: Nama Lengkap | D: Kelas | E: Photo URL
```

Salin **ID Spreadsheet** dari URL-nya (bagian antara `/d/` dan `/edit`).

### 2. Siapkan Folder Google Drive
Buat folder baru di Google Drive untuk menyimpan foto absensi. Salin **ID folder** dari URL-nya.

### 3. Deploy Backend (Google Apps Script)
1. Buka [script.google.com](https://script.google.com) → **New Project**
2. Salin seluruh isi `Code.gs` ke editor
3. Ganti konstanta di bagian atas:
   ```js
   const FOLDER_ID      = 'ID-folder-drive-anda';
   const SPREADSHEET_ID = 'ID-spreadsheet-anda';
   ```
4. Klik **Deploy → New deployment → Web app**
   - **Execute as**: Me
   - **Who has access**: Anyone
5. Klik **Deploy**, lalu salin **Web App URL** yang muncul
   (format: `https://script.google.com/macros/s/XXXX/exec`)

### 4. Konfigurasi Frontend
Buka `app.js` dan ganti:
```js
const APP_SCRIPT_URL = 'https://script.google.com/macros/s/XXXX/exec';
```

### 5. Deploy Frontend (GitHub Pages)
1. Push repo ini ke GitHub
2. Buka **Settings → Pages**
3. Pilih source: branch `main`, folder `/ (root)`
4. Klik **Save** — situs akan aktif di `https://natedekaka.github.io/absensi-pjj/`

## ✨ Fitur

- ✅ Form absensi: NIS, Nama Lengkap, Kelas, Foto
- ✅ Kompresi foto otomatis di sisi klien (maks 600px, JPEG 0.8) sebelum diunggah
- ✅ Foto tersimpan di Google Drive dengan akses "anyone with link can view"
- ✅ Data absensi tersimpan di Google Sheet (dengan tanggal & jam kehadiran)
- ✅ Kolase foto absensi per siswa (cari lewat NIS)
- ✅ Ekspor seluruh data absensi ke **CSV** (`?action=export`)
- ✅ Validasi input & pesan error dalam Bahasa Indonesia
- ✅ Responsif untuk ponsel (capture kamera langsung)
- ✅ Mendukung ±300 siswa absensi harian

## 🔄 Alur Data

```
Siswa isi form (index.html)
        │  foto dikompresi → base64
        ▼
fetch POST (JSON) ──► Apps Script Web App (Code.gs)
                          │  decode base64 → blob
                          ├─► simpan foto ke Drive Folder (share: public view)
                          └─► append baris ke Sheet: Timestamp | NIS | Nama | Kelas | URL
        ▼
Siswa buka kolase.html → fetch GET ?nis=XXX → tampilkan grid foto + tanggal & jam
        ▼
Guru klik "Export Absensi (CSV)" → fetch GET ?action=export → unduh file CSV
```
