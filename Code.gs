/**
 * ============================================================
 *  Absensi PJJ — Backend Google Apps Script
 * ============================================================
 *  INSTRUKSI PENDEPLOYAN:
 *    1. Buka file ini di Google Apps Script (script.google.com)
 *    2. Klik "Deploy → New deployment"
 *    3. Pilih "Web app" dan set:
 *         - Execute as: Me
 *         - Who has access: Anyone
 *    4. Deploy (buat version baru dulu), klik "Deploy"
 *    5. Salin "Web app URL" yang muncul → tempel di app.js
 *       pada variabel APP_SCRIPT_URL
 *    6. Ganti FOLDER_ID dan SPREADSHEET_ID dengan milik sendiri
 *    7. Simpan dan redeploy jika ada perubahan konstanta
 * ============================================================
 */

// --- KONFIGURASI (ganti dengan ID milik Anda) ---
// FOLDER_ID: bagian URL folder Drive di antara "/folders/" dan "?"
// Contoh: https://drive.google.com/drive/folders/18OoFOTGYRWxKaMasqHRHQdp_EKOKqhSU?usp=sharing
const FOLDER_ID      = '18OoFOTGYRWxKaMasqHRHQdp_EKOKqhSU';   // Folder di Google Drive untuk foto

// SPREADSHEET_ID: bagian URL Sheet di antara "/d/" dan "/edit"
// Contoh: https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456789/edit
const SPREADSHEET_ID = '1_ped9-VhlUKb6fTEXl8INa7Uf44wbV69h9cRzYoUY-A';        // Sheet untuk data absensi

/* ---------------------------------------------------------
 *  HANDLER HTTP PUBLIK
 * --------------------------------------------------------- */

function doPost(e) {
    // Tangani preflight CORS (browser HP sering kirim OPTIONS dulu)
    if (e && e.parameter && e.parameter.method === 'OPTIONS') {
        return ContentService.createTextOutput('')
            .setMimeType(ContentService.MimeType.TEXT_PLAIN)
            .setHeaders({
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            });
    }
    var res = { ok: false, message: '', photos: [] };
    try {
        var body = e.postData ? e.postData.contents : '';
        var data = JSON.parse(body);

        if (!data || !data.photo || !data.nis) {
            res.message = 'Data tidak lengkap: photo & NIS wajib diisi.';
            return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.APPLICATION_JSON)
        .setHeaders({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        }

        var nis    = String(data.nis).trim();
        var nama   = String(data.nama || '').trim();
        var kelas = String(data.kelas || '').trim();
        var photoB64 = String(data.photo);
        // Bersihkan prefix data:image/jpeg;base64, jika ada
        var cleanBase64 = photoB64.replace(/^data:image\/[^;]+;base64,/, '');

        // Decode base64 → bytes → Blob
        var byteChars = Utilities.base64Decode(cleanBase64);
        var blob = Utilities.newBlob(byteChars, 'image/jpeg');

        // Nama file unik per siswa
        var fileName = 'absensi_' + nis + '_' + new Date().getTime() + '.jpg';

        // --- Simpan ke Google Drive ---
        var newFile = DriveApp.createFile(fileName, blob);
        newFile.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEWER);
        var fileUrl = newFile.getUrl();

        // --- Simpan ke Google Sheet ---
        // Kolom: Timestamp | NIS | Nama Lengkap | Kelas | Photo URL
        SpreadsheetApp.openById(SPREADSHEET_ID).getActiveSheet()
            .appendRow([new Date(), nis, nama, kelas, fileUrl]);

        res.ok = true;
        res.message = 'Absensi berhasil disimpan.';
    } catch (err) {
        console.log(err.toString());
        res.message = 'Error: ' + err.message;
    }
    return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.APPLICATION_JSON)
        .setHeaders({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
}

function doGet(e) {
    var params = e.parameter || {};
    var action = (params['action'] || '').toString().trim().toLowerCase();

    // --- ACTION: EXPORT (ekspor semua data absensi ke CSV) ---
    if (action === 'export') {
        var sh = SpreadsheetApp.openById(SPREADSHEET_ID).getActiveSheet();
        var lastRow = sh.getLastRow();
        var csv = 'Timestamp,NIS,Nama Lengkap,Kelas,Photo URL\r\n';
        for (var i = 2; i <= lastRow; i++) { // mulai dari baris 2, lewati header
            var row = [
                sh.getRange(i, 1).getDisplayValue(),
                sh.getRange(i, 2).getValue(),
                sh.getRange(i, 3).getValue(),
                sh.getRange(i, 4).getValue(),
                sh.getRange(i, 5).getValue()
            ];
            var line = row.map(function (v) {
                v = String(v);
                if (v.indexOf(',') > -1) v = '"' + v + '"';
                return v;
            }).join(',');
            csv += line + '\r\n';
        }
        return ContentService.createTextOutput(csv).setMimeType(ContentService.MimeType.TEXT_PLAIN)
            .setHeaders({
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            });
    }

    // --- ACTION: AMBIL FOTO PER NIS (default) ---
    var res = { ok: false, message: '', photos: [] };
    try {
        var nis = (params['nis'] || '').toString().trim();

        if (!nis) {
            res.message = 'NIS tidak ditemukan.';
            return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.APPLICATION_JSON)
        .setHeaders({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        }

        var sh = SpreadsheetApp.openById(SPREADSHEET_ID).getActiveSheet();
        var lastRow = sh.getLastRow();
        var matched = [];

        for (var i = 2; i <= lastRow; i++) { // mulai dari baris 2, lewati header
            var cellVal = String(sh.getRange(i, 2).getValue());
            if (cellVal === nis) {
                matched.push({
                    url:   String(sh.getRange(i, 5).getValue()),
                    kelas: String(sh.getRange(i, 4).getValue()),
                    date:  sh.getRange(i, 1).getValue()
                });
            }
        }

        res.photos = matched;
        res.ok = true;
        res.message = 'Berhasil memuat ' + matched.length + ' kegiatan absensi.';
    } catch (err) {
        console.log(err.toString());
        res.message = 'Error: ' + err.message;
    }
    return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.APPLICATION_JSON)
        .setHeaders({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
}
