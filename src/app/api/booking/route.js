// src/app/api/booking/route.js
import { NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabase';

export async function POST(req) {
  try {
    // 1. Ambil data HANYA SEKALI menggunakan req.json()
    const { nama, instansi, whatsapp } = await req.json();
    const kodeBooking = `SQ-${Date.now()}`;

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

    // 2. SIMPAN KE SUPABASE
    const { error: supabaseError } = await supabase
      .from('tamu')
      .insert([{
        nama: nama,
        instansi: instansi,
        whatsapp: whatsapp
      }]);

    if (supabaseError) {
      console.error("Gagal simpan ke Supabase:", supabaseError);
      return NextResponse.json({ success: false, message: "Gagal simpan database Supabase" }, { status: 500 });
    }

    // 3. SIMPAN KE GOOGLE SHEETS
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];

    await sheet.addRow({
      Nama: nama,
      Instansi: instansi,
      WhatsApp: whatsapp,
      Kode: kodeBooking,
      Status: 'Pending',
      'Waktu Hadir': '-'
    });

    // 4. GENERATE QR CODE
    const qrCodeDataUrl = await QRCode.toDataURL(kodeBooking);

    // 5. KIRIM PESAN WHATSAPP VIA FONNTE
    try {
      let formattedWhatsapp = whatsapp.trim();
      if (formattedWhatsapp.startsWith('0')) {
        formattedWhatsapp = '62' + formattedWhatsapp.slice(1);
      } else if (formattedWhatsapp.startsWith('+')) {
        formattedWhatsapp = formattedWhatsapp.replace('+', '');
      }

      const formData = new URLSearchParams();
      formData.append('target', formattedWhatsapp);
      formData.append('message', `Halo *${nama}*,\n\nReservasi kamu di SowanQR berhasil! 🎉\n\nKode Booking: ${kodeBooking}\n\nSilakan tunjukkan QR Code yang muncul di website saat tiba di gerbang.\n\nTerima kasih!`);

      const waResponse = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
          'Authorization': process.env.WA_GATEWAY_TOKEN
        },
        body: formData
      });

      const waResult = await waResponse.json();
      console.log('Respons dari Fonnte:', waResult);

    } catch (waError) {
      console.error('Gagal mengirim WA (tapi data sheet aman):', waError.message);
    }

    // 6. KEMBALIKAN RESPONS SUKSES KE FRONTEND
    return NextResponse.json({ success: true, qr: qrCodeDataUrl, code: kodeBooking });

  } catch (error) {
    console.error('Error pada API Booking:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}