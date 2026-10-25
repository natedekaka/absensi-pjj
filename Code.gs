/**
 * Absensi PJJ - Backend Google Apps Script
 */

const FOLDER_ID      = '18OoFOTGYRWxKaMasqHRHQdp_EKOKqhSU';
const SPREADSHEET_ID = '1p1Dy0XRSsy96V5JxmtjfxIAOiUVtOYY7T4jLMOdUoh0';

function getActiveSheet(ss) {
  let sh = ss.getSheetByName('absensi');
  if (!sh) {
    // Sheet bernama 'absensi' tidak ada — coba Sheet1 kalau ada
    sh = ss.getSheetByName('Sheet1');
  }
  if (!sh) {
    // Jika tidak ada sheet pun, ambil sheet pertama
    sh = ss.getSheets()[0];
  }
  return sh;
}

function ensureHeader(sh) {
  if (sh.getLastRow() === 0) {
    sh.appendRow(['Timestamp', 'NIS', 'Nama Lengkap', 'Kelas', 'Photo URL']);
  }
}

function appendRow(sh, row) {
  sh.appendRow(row);
  SpreadsheetApp.flush();
}

function doPost(e) {
  try {
    let rawData = '';

    if (e && e.parameter && typeof e.parameter.data !== 'undefined') {
      rawData = e.parameter.data;
    } else if (e && e.postData && e.postData.contents) {
      rawData = e.postData.contents;
      if (rawData.indexOf('data=') === 0) {
        rawData = rawData.substring(5);
        try {
          rawData = decodeURIComponent(rawData.replace(/\+/g, ' '));
        } catch (ex) {}
      }
    }

    if (!rawData) {
      return jsonResponse({ ok: false, message: "Tidak ada data yang dikirim." });
    }

    const data = JSON.parse(rawData);

    if (!data.nis || !data.nama || !data.photo) {
      return jsonResponse({ ok: false, message: "Data tidak lengkap. Isi NIS, Nama, Kelas & Foto." });
    }

    const nis    = String(data.nis).trim();
    const nama   = String(data.nama).trim();
    const kelas  = String(data.kelas || '').trim();
    let photoB64 = String(data.photo);

    photoB64 = photoB64.replace(/^data:image\/[^;]+;base64,/, '');

    const bytes = Utilities.base64Decode(photoB64);
    const blob  = Utilities.newBlob(bytes, 'image/jpeg', 'absensi_' + nis + '_' + Date.now() + '.jpg');

    // ---- Simpan foto ke Drive ----
    let fileUrl = '';
    try {
      const folder = DriveApp.getFolderById(FOLDER_ID);
      const file   = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEWER);
      fileUrl = file.getUrl();
    } catch (driveErr) {
      return jsonResponse({ ok: false, message: "Gagal menyimpan foto ke Drive: " + driveErr.toString() });
    }

    // ---- Simpan data ke Sheet ----
    try {
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      const sh = getActiveSheet(ss);
      ensureHeader(sh);
      appendRow(sh, [new Date(), nis, nama, kelas, fileUrl]);
    } catch (sheetErr) {
      return jsonResponse({ ok: false, message: "Gagal menyimpan ke Sheet: " + sheetErr.toString() });
    }

    return jsonResponse({ ok: true, message: "Absensi berhasil disimpan." });
  } catch (err) {
    return jsonResponse({ ok: false, message: "Error: " + err.toString() });
  }
}

function doGet(e) {
  try {
    const params = e.parameter || {};
    const action = (params.action || '').toString().toLowerCase();
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = getActiveSheet(ss);

    if (sh.getLastRow() === 0) {
      sh.appendRow(['Timestamp', 'NIS', 'Nama Lengkap', 'Kelas', 'Photo URL']);
    }

    if (action === 'export') {
      const lastRow = sh.getLastRow();
      let csv = 'Timestamp,NIS,Nama Lengkap,Kelas,Photo URL\r\n';

      for (let i = 2; i <= lastRow; i++) {
        const row = [
          sh.getRange(i, 1).getDisplayValue(),
          sh.getRange(i, 2).getValue(),
          sh.getRange(i, 3).getValue(),
          sh.getRange(i, 4).getValue(),
          sh.getRange(i, 5).getValue()
        ].map(function(v) {
          v = String(v);
          if (v.indexOf(',') >= 0 || v.indexOf('"') >= 0 || v.indexOf('\n') >= 0) {
            v = '"' + v.replace(/"/g, '""') + '"';
          }
          return v;
        }).join(',');

        csv += row + '\r\n';
      }

      return ContentService.createTextOutput(csv).setMimeType(ContentService.MimeType.TEXT_PLAIN);
    }

    const nis = (params.nis || '').toString().trim();
    if (!nis) return jsonResponse({ ok: false, message: "NIS tidak ditemukan.", photos: [] });

    const lastRow = sh.getLastRow();
    const photos = [];

    for (let i = 2; i <= lastRow; i++) {
      if (String(sh.getRange(i, 2).getValue()).trim() === nis) {
        photos.push({
          url: String(sh.getRange(i, 5).getValue()),
          kelas: String(sh.getRange(i, 4).getValue()),
          date: sh.getRange(i, 1).getValue()
        });
      }
    }

    return jsonResponse({ ok: true, message: "Berhasil memuat " + photos.length + " data.", photos: photos });
  } catch (err) {
    return jsonResponse({ ok: false, message: "Error: " + err.message });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.APPLICATION_JSON);
}
