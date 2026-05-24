import { NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabase';

export async function POST(req) {
  try {
    const { nama, instansi, whatsapp, nik, email, keperluan, menemui, tandaTanganBase64 } = await req.json();
    const kodeBooking = `SQ-${Date.now()}`;

    const buffer = Buffer.from(tandaTanganBase64.replace(/^data:image\/\w+;base64,/, ""), 'base64');
    const fileName = `ttd-${nik}-${Date.now()}.png`;

    const { data: storageData, error: storageError } = await supabase.storage
      .from('tanda_tangan') 
      .upload(fileName, buffer, { contentType: 'image/png' });

    if (storageError) {
      console.error("Detail Error Supabase Storage:", storageError);
      throw new Error(`Gagal upload tanda tangan: ${storageError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage.from('tanda_tangan').getPublicUrl(fileName);

    const { error: profilError } = await supabase
      .from('profil_tamu')
      .upsert([{ 
        nik, 
        nama, 
        instansi, 
        whatsapp, 
        email, 
        tanda_tangan: publicUrl 
      }], { onConflict: 'nik' });

    if (profilError) {
      console.error("Gagal simpan ke profil_tamu:", profilError);
      throw profilError;
    }

    // INSERT KE TABEL public.kunjungan_tamu
    const { error: kunjunganError } = await supabase
      .from('kunjungan_tamu')
      .insert([{
        nik, 
        keperluan, 
        menemui,
        kode: kodeBooking,
        status: 'Pending',
        waktu_hadir: '-'
      }]);

    if (kunjunganError) {
      console.error("Gagal simpan ke kunjungan_tamu:", kunjunganError);
      throw kunjunganError;
    }

    // SIMPAN KE GOOGLE SHEETS
    let googleEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let googleKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!googleEmail || !googleKey) {
      try {
        const fs = require('fs');
        const path = require('path');
        const secrets = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'secrets.json'), 'utf8'));
        googleEmail = googleEmail || secrets.client_email;
        googleKey = googleKey || secrets.private_key;
      } catch (e) {
        console.warn("Relying on environment variables for Google Sheets.");
      }
    }

    const auth = new JWT({
      email: googleEmail,
      key: googleKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];

    await sheet.addRow({
      NIK: nik,
      Nama: nama,
      Instansi: instansi,
      WhatsApp: whatsapp,
      Email: email,
      Keperluan: keperluan,
      Menemui: menemui,
      Kode: kodeBooking,
      Status: 'Pending',
      'Tanda Tangan': publicUrl,
      'Waktu Hadir': '-'
    });

    // GENERATE QR CODE
    const qrCodeDataUrl = await QRCode.toDataURL(kodeBooking);

    // KIRIM WHATSAPP VIA FONNTE
    try {
      let formattedWhatsapp = whatsapp.trim();
      if (formattedWhatsapp.startsWith('0')) {
        formattedWhatsapp = '62' + formattedWhatsapp.slice(1);
      } else if (formattedWhatsapp.startsWith('+')) {
        formattedWhatsapp = formattedWhatsapp.replace('+', '');
      }

      const formData = new URLSearchParams();
      formData.append('target', formattedWhatsapp);
      formData.append('message', `Halo *${nama}*,\n\nReservasi kamu di SowanQR berhasil! 🎉\n\nKode Booking: *${kodeBooking}*\n\nDengan keperluan untuk: ${keperluan}\nAkan menemui: ${menemui}\n\nSilakan tunjukkan QR Code yang muncul di website saat tiba di gerbang.\n\nTerika Kasih! KELOMPOK PJBL BUKU TAMU`);

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
      console.error('Gagal mengirim WA (tapi data database & sheet aman):', waError.message);
    }

    // Kembalikan respons sukses ke frontend
    return NextResponse.json({ success: true, qr: qrCodeDataUrl, code: kodeBooking });

  } catch (error) {
    console.error('Error pada API Register:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}