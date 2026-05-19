import { NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

export async function POST(request) {
  try {
    const { kodeBooking } = await request.json();

    let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let key = process.env.GOOGLE_PRIVATE_KEY;

    if (!email || !key) {
      try {
        const fs = require('fs');
        const path = require('path');
        const secrets = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'secrets.json'), 'utf8'));
        email = email || secrets.client_email;
        key = key || secrets.private_key;
      } catch (e) {
        console.warn("Could not load secrets.json, relying on environment variables.");
      }
    }

    if (!email || !key) {
      throw new Error("Missing Google Service Account credentials. Please set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY.");
    }

    const auth = new JWT({
      email: email,
      key: key.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    if (!process.env.GOOGLE_SHEET_ID) {
      throw new Error("Missing GOOGLE_SHEET_ID environment variable.");
    }

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    
    const rows = await sheet.getRows();
    // Cari baris berdasarkan Kode Booking
    const row = rows.find(r => r.get('Kode') === kodeBooking);

    if (!row) {
      return NextResponse.json({ success: false, message: 'Kode QR Tidak Valid!' }, { status: 404 });
    }

    if (row.get('Status') === 'Hadir') {
      return NextResponse.json({ success: false, message: `Tamu atas nama ${row.get('Nama')} sudah melakukan check-in sebelumnya!` });
    }

    // Update data di Google Sheets
    row.set('Status', 'Hadir');
    row.set('Waktu Hadir', new Date().toLocaleString('id-ID'));
    await row.save();

    return NextResponse.json({ 
      success: true, 
      message: `Check-in Berhasil! Selamat datang, ${row.get('Nama')} dari ${row.get('Instansi')}.` 
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}