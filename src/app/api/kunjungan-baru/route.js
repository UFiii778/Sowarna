import { NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

export async function POST(req) {
  try {
    const data = await req.json();

    try {
      const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      let key = process.env.GOOGLE_PRIVATE_KEY;

      if (email && key && process.env.GOOGLE_SHEET_ID) {
        const auth = new JWT({
          email: email,
          key: key.replace(/\\n/g, '\n'),
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
        await doc.loadInfo();
        
        const sheet = doc.sheetsByTitle['Riwayat_Kunjungan'];
        
        if (sheet) {
          await sheet.addRow({
            'Kode': data.kode,
            'NIK': data.nik,
            'Nama': data.nama,
            'WhatsApp': data.whatsapp,
            'Keperluan': data.keperluan,
            'Menemui': data.menemui,
            'Status': 'Pending',
            'Waktu Hadir': '-',
            'Tanggal': new Date(data.created_at).toLocaleDateString('id-ID'),
            'Tanda Tangan': data.tanda_tangan_url || '-'
          });
        }
      }
    } catch (sheetErr) {
      console.error('Gagal mencatat booking awal ke Google Sheets:', sheetErr.message);
    }

    try {
      if (process.env.FOONTE_TOKEN && data.whatsapp) {
        const pesanWA = `Halo *${data.nama}*,\n\nBooking kunjungan SowanQR Anda berhasil dibuat!\n\n📌 *Detail Kunjungan:* \n• Kode Sowan: ${data.kode}\n• Keperluan: ${data.keperluan}\n• Menemui: ${data.menemui}\n• Status: Waiting For Scan\n\nSilakan tunjukkan QR Code pada dashboard Anda kepada petugas atau guru saat tiba di lokasi untuk memproses verifikasi kehadiran.\n\nTerima kasih.`;

        await fetch('https://api.foonte.com/send', {
          method: 'POST',
          headers: {
            'Authorization': process.env.FOONTE_TOKEN
          },
          body: new URLSearchParams({
            'target': data.whatsapp,
            'message': pesanWA
          })
        });
      }
    } catch (foonteErr) {
      console.error('Gagal mengirim WhatsApp Foonte:', foonteErr.message);
    }

    return NextResponse.json({ success: true, message: 'Data kunjungan berhasil disinkronkan' });

  } catch (err) {
    console.error("SERVER ERROR AT API/KUNJUNGAN-BARU:", err.message);
    return NextResponse.json({ success: false, message: 'Gagal memproses data internal' }, { status: 500 });
  }
}