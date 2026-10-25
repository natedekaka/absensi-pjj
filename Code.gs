/**
 * Absensi PJJ - Backend Google Apps Script
 */

const FOLDER_ID      = '18OoFOTGYRWxKaMasqHRHQdp_EKOKqhSU';
const SPREADSHEET_ID = '1_ped9-VhlUKb6fTEXl8INa7Uf44wbV69h9cRzYoUY-A';

function doPost(e) {
  try {
    let rawData = '';

    // Baca dari FormData (kirim pakai mode: no-cors)
    if (e && e.parameter && e.parameter.data) {
      rawData = e.parameter.data;
    }
    // Fallback kalau ada yang kirim JSON langsung
    else if (e && e.postData && e.postData.contents) {
      rawData = e.postData.contents;
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

    // Hapus prefix data:image/...;base64,
    photoB64 = photoB64.replace(/^data:image\/[^;]+;base64,/, '');

    const bytes = Utilities.base64Decode(photoB64);
    const blob  = Utilities.newBlob(bytes, 'image/jpeg', 'absensi_' + nis + '_' + Date.now() + '.jpg');

    const folder = DriveApp.getFolderById(FOLDER_ID);
    const file   = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEWER);
    const fileUrl = file.getUrl();

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getActiveSheet();
    sheet.appendRow([new Date(), nis, nama, kelas, fileUrl]);

    return jsonResponse({ ok: true, message: "Absensi berhasil disimpan." });
  } catch (err) {
    return jsonResponse({ ok: false, message: "Error: " + err.message });
  }
}

function doGet(e) {
  try {
    const params = e.parameter || {};
    const action = (params.action || '').toString().toLowerCase();

    if (action === 'export') {
      const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getActiveSheet();
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

    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getActiveSheet();
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
