'use strict';

/* =========================================================
 * Frontend Logic for Attendance System (Absensi PJJ)
 * Works with index.html (form) and kolase.html (viewer).
 * Requires style.css and a deployed Code.gs web app.
 * ========================================================= */

/* ---------------------------------------------------------
 * CONFIGURATION — REPLACE THIS WITH YOURS
 * Get the URL from the Google Apps Script "Deploy" dialog,
 * or by running: https://script.google.com/home/executions/...
 * --------------------------------------------------------- */
const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbycUBDOJ_D1QgK2YlNb1V-xvNYm5Rv45JVM_dS7lJt183Z1tWbdsFEhtByFPibFG7ebPw/exec';

/* ---------------------------------------------------------
 * DOM REFERENCES
 * --------------------------------------------------------- */
const attendanceForm  = document.getElementById('attendanceForm');
const nisInput        = document.getElementById('nis');
const namaInput       = document.getElementById('nama');
const kelasInput     = document.getElementById('kelas');
const fotoInput       = document.getElementById('foto');
const preview         = document.getElementById('preview');
const hint            = document.getElementById('photoHint');
const submitBtn       = document.getElementById('submitBtn');
const messageArea     = document.getElementById('messageArea');
const collageForm     = document.getElementById('collageForm');
const nisCollage      = document.getElementById('nisCollage');
const viewBtn         = document.getElementById('viewBtn');
const collageMessage  = document.getElementById('collageMessage');
const collageGrid     = document.getElementById('collageGrid');
const exportBtn       = document.getElementById('exportBtn');

/* ---------------------------------------------------------
 * PART 1 — ATTENDANCE FORM (index.html)
 * --------------------------------------------------------- */
let compressedDataUrl = ''; // base64 photo stored after compression

if (fotoInput) {
    fotoInput.addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;

    // Validasi tipe file
    if (!file.type.startsWith('image/')) {
        showMessage(messageArea, 'Silakan pilih file gambar (image).', 'error');
        return;
    }
    // Validasi ukuran file (maksimal 10 MB — melarang pembatasan terlalu ketat agar
    // foto HP berkualitas tinggi tidak di banned sebelum dikompresi)
    if (file.size > 10 * 1024 * 1024) {
        showMessage(messageArea, 'File terlalu besar. Maaf, ukuran file harus kurang dari 10 MB.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        // Compress via canvas — resize max width to 600px, JPEG quality 0.8
        const img = new Image();
        img.onload = function () {
            const canvas = document.createElement('canvas');
            const ctx    = canvas.getContext('2d');
            const MAX_W  = 600;
            let w = img.width;
            let h = img.height;
            if (w > MAX_W) {
                h = Math.round((h * MAX_W) / w);
                w = MAX_W;
            }
            canvas.width  = w;
            canvas.height = h;
            ctx.drawImage(img, 0, 0, w, h);

            // Kompresi adaptif: mulai kualitas 0.8, turunkan jika masih > 300KB
            let quality = 0.8;
            let testUrl = '';
            do {
                testUrl = canvas.toDataURL('image/jpeg', quality);
                quality -= 0.1;
            } while (testUrl.length > 300 * 1024 && quality > 0.4);
            compressedDataUrl = testUrl;
            preview.src   = compressedDataUrl;
            preview.classList.remove('hidden');
            hint.textContent = 'Gambar siap klik lagi jika ingin ganti';
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
});
}

/* ---------------------------------------------------------
 * ATTENDANCE FORM SUBMISSION (hanya ada di index.html)
 * --------------------------------------------------------- */
if (attendanceForm) {
    attendanceForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        if (!compressedDataUrl) {
            showMessage(messageArea, 'Silakan pilih foto terlebih dahulu.', 'error');
            return;
        }

        const nis  = nisInput.value.trim();
        const nama = namaInput.value.trim();

        const payload = {
            photo: compressedDataUrl,
            nis: nis,
            nama: nama,
            kelas: kelasInput ? kelasInput.value.trim() : ''
        };

        try {
            showMessage(messageArea, 'Mengirim data absensi...', 'success');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Menyimpan...';

            const formData = new FormData();
            formData.append('data', JSON.stringify(payload));

            await fetch(APP_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: formData
            });

            showMessage(messageArea, 'Absensi berhasil dikirim! Mengalihkan ke halaman kolase...', 'success');
            attendanceForm.reset();
            compressedDataUrl = '';
            if (preview) preview.classList.add('hidden');

            setTimeout(function () {
                window.location.href = 'kolase.html';
            }, 1500);
        } catch (err) {
            console.error('Fetch error:', err);
            showMessage(messageArea, 'Gagal terhubung ke server. Coba lagi nanti.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Simpan Absensi';
        }
    });
}
/* ---------------------------------------------------------
 * COLLAGE VIEWER (hanya ada di kolase.html)
 * --------------------------------------------------------- */
if (collageForm) {
    collageForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const nis = nisCollage.value.trim();
    if (!nis) {
        showMessage(collageMessage, 'Harap masukkan NIS terlebih dahulu.', 'error');
        return;
    }

    viewBtn.disabled = true;
    viewBtn.textContent = 'Membuka...';

    try {
        const targetUrl = `${APP_SCRIPT_URL}?nis=${encodeURIComponent(nis)}`;
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
        const res = await fetch(proxyUrl);
        const result = await res.json();

        if (res.ok && result.ok) {
            renderCollage(result.photos || []);
            showMessage(collageMessage, result.message || 'Sedang menampilkan absensi.', 'success');
        } else {
            showMessage(collageMessage, result.message || 'Gagal memuat absensi.', 'error');
            collageGrid.innerHTML = '';
        }
    } catch (err) {
        console.error(err);
        showMessage(collageMessage, 'Terjadi kesalahan koneksi. Coba lagi.', 'error');
    } finally {
        viewBtn.disabled = false;
        viewBtn.textContent = 'Tampilkan Absensi';
    }
});
}

/* ---------------------------------------------------------
 * RENDER COLLAGE GRID
 * --------------------------------------------------------- */
function renderCollage(photos) {
    collageGrid.innerHTML = '';

    if (!photos || photos.length === 0) {
        collageGrid.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:#9aa0a6;">Belum ada data absensi.</p>';
        return;
    }

    photos.forEach(function (p) {
        const item = document.createElement('div');
        item.className = 'photo-item';

        const img = document.createElement('img');
        img.src = p.url;
        img.alt = 'Foto absensi';
        img.loading = 'lazy';

        const date = document.createElement('div');
        date.className = 'photo-date';
        // Tampilkan tanggal dan jam kehadiran lengkap
        date.textContent = p.date ? new Date(p.date).toLocaleString('id-ID') : '';

        item.appendChild(img);
        item.appendChild(date);
        collageGrid.appendChild(item);
    });
}

/* ---------------------------------------------------------
 * EXPORT ABSENSI KE CSV (hanya ada di kolase.html)
 * Mengakses endpoint /?action=export di Apps Script,
 * lalu mengunduh hasilnya sebagai file CSV.
 * --------------------------------------------------------- */
if (exportBtn) {
    exportBtn.addEventListener('click', async function () {
    exportBtn.disabled = true;
    exportBtn.textContent = 'Mengekspor...';

    try {
        const targetUrl = `${APP_SCRIPT_URL}?action=export`;
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error('Export gagal');

        const csv = await res.text();
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'data_absensi_' + new Date().toISOString().slice(0, 10) + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showMessage(collageMessage, 'Ekspor absensi berhasil.', 'success');
    } catch (err) {
        console.error(err);
        showMessage(collageMessage, 'Gagal mengekspor absensi.', 'error');
    } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = 'Export Absensi (CSV)';
    }
});
}

/* ---------------------------------------------------------
 * HELPER
 * --------------------------------------------------------- */
function showMessage(targetEl, text, type) {
    targetEl.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = type;
    msg.textContent = text;
    targetEl.appendChild(msg);
}
