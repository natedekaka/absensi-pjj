/**
 * Absensi PJJ - Backend Google Apps Script
 */

const FOLDER_ID      = '18OoFOTGYRWxKaMasqHRHQdp_EKOKqhSU';  // Ganti kalau beda
const SPREADSHEET_ID = '1_ped9-VhlUKb6fTEXl8INa7Uf44wbV69h9cRzYoUY-A';  // Ganti kalau beda

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json({ ok: false, message: "Tidak ada data yang dikirim." });
    }

    const data = JSON.parse(e.postData.contents);

    if (!data.nis || !data.nama || !data.photo) {
      return json({ ok: false, message: "Data tidak lengkap. Isi NIS, Nama, Kelas & Foto." });
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

    return json({ ok: true, message: "Absensi berhasil disimpan." });
  } catch (err) {
    return json({ ok: false, message: "Error: " + err.message });
  }
}

function doGet(e) {
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
      ].map(v => {
        v = String(v);
        if (v.indexOf(',') >= 0) v = '"' + v.replace(/"/g, '""') + '"';
        return v;
      }).join(',');
      csv += row + '\r\n';
    }

    return ContentService.createTextOutput(csv).setMimeType(ContentService.MimeType.TEXT_PLAIN);
  }

  const nis = (params.nis || '').toString().trim();
  if (!nis) return json({ ok: false, message: "NIS tidak ditemukan.", photos: [] });

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

  return json({ ok: true, message: "Berhasil memuat " + photos.length + " data.", photos: photos });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.APPLICATION_JSON);
}
