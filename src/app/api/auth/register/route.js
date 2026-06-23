import { NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabase';

export async function POST(req) {
  try {
    const body = await req.json();
    
    // 🔥 FIX 1: Ubah 'ttd' menjadi 'signature' agar sinkron dengan data Base64 dari page.js
    const { nama, instansi, whatsapp, nik, email, keperluan, menemui, signature: tandaTanganBase64 } = body;

    // 🔥 FIX 2: Tambahkan properti 'message' di setiap respon error agar terbaca oleh pop-up merah frontend
    if (!nik || nik.trim().length < 16 || isNaN(nik)) {
      return NextResponse.json({ success: false, message: 'NIK tidak valid. Harus berupa 16 digit angka.', error: 'NIK tidak valid.' }, { status: 400 });
    }
    if (!nama || !nama.trim()) {
      return NextResponse.json({ success: false, message: 'Nama wajib diisi.', error: 'Nama wajib diisi.' }, { status: 400 });
    }
    if (!whatsapp || !whatsapp.trim()) {
      return NextResponse.json({ success: false, message: 'Nomor WhatsApp wajib diisi.', error: 'Nomor WhatsApp wajib diisi.' }, { status: 400 });
    }
    if (!tandaTanganBase64) {
      return NextResponse.json({ success: false, message: 'Tanda tangan wajib diunggah.', error: 'Tanda tangan wajib diunggah.' }, { status: 400 });
    }

    // 2. GENERATE KODE BOOKING UNIK
    const randomString = Math.random().toString(36).substring(2, 6).toUpperCase();
    const kodeBooking = `SQ-${Date.now()}-${randomString}`;

    // 3. UPLOAD TANDA TANGAN KE SUPABASE STORAGE
    const buffer = Buffer.from(tandaTanganBase64.replace(/^data:image\/\w+;base64,/, ""), 'base64');
    const fileName = `ttd-${nik}-${kodeBooking}.png`;

    const { data: storageData, error: storageError } = await supabase.storage
      .from('tanda_tangan')
      .upload(fileName, buffer, { contentType: 'image/png' });

    if (storageError) {
      console.error("Detail Error Supabase Storage:", storageError);
      return NextResponse.json({ success: false, message: `Gagal upload tanda tangan ke storage: ${storageError.message}` }, { status: 500 });
    }

    // ==========================================
    // TAMBAHKAN VALIDASI DUPLIKASI WA SEBELUM SIMPAN
    // ==========================================
    const nomorWABersih = whatsapp.trim();
    // Cek apakah nomor WA sudah digunakan oleh NIK yang berbeda
    const { data: waExist, error: waCheckError } = await supabase
      .from('profil_tamu')
      .select('nik, nama')
      .eq('whatsapp', nomorWABersih)
      .maybeSingle();

    if (waCheckError) {
      console.error("Gagal cek validasi WA:", waCheckError);
    }

    // Jika nomor WA ketemu di DB dan NIK-nya berbeda dengan yang sedang menginput
    if (waExist && waExist.nik !== nik.trim()) {
      return NextResponse.json({ 
        success: false, 
        message: `Nomor WhatsApp tersebut sudah terdaftar atas nama ${waExist.nama}. Silakan gunakan nomor lain atau masuk lewat menu login!`,
        error: 'WhatsApp duplicate.' 
      }, { status: 400 });
    }

    const { data: { publicUrl } } = supabase.storage.from('tanda_tangan').getPublicUrl(fileName);

    // 4. SIMPAN KE TABEL PROFIL_TAMU (UPSERT)
    const { error: profilError } = await supabase
      .from('profil_tamu')
      .upsert([{
        nik: nik.trim(),
        nama: nama.trim(),
        instansi: (instansi && instansi.trim()) ? instansi.trim() : '-',
        whatsapp: whatsapp.trim(),
        email: (email && email.trim()) ? email.trim().toLowerCase() : '-',
        tanda_tangan: publicUrl
      }], { onConflict: 'nik' });

    if (profilError) {
      console.error("Gagal simpan ke profil_tamu:", profilError);
      return NextResponse.json({ success: false, message: `Gagal menyimpan profil ke database: ${profilError.message}` }, { status: 500 });
    }

    // 5. INSERT KE TABEL KUNJUNGAN_TAMU
    const { error: kunjunganError } = await supabase
      .from('kunjungan_tamu')
      .insert([{
        nik: nik.trim(),
        keperluan: keperluan || '-',
        menemui: menemui || '-',
        kode: kodeBooking,
        status: 'Pending',
        waktu_hadir: '-'
      }]);

    if (kunjunganError) {
      console.error("Gagal simpan ke kunjungan_tamu:", kunjunganError);
      return NextResponse.json({ success: false, message: `Gagal membuat data kunjungan: ${kunjunganError.message}` }, { status: 500 });
    }

    let sheetsSaved = false;
    let waSent = false;

    // 6. SIMPAN KE GOOGLE SHEETS
    try {
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
          console.warn("Menggunakan Environment Variables untuk Google Sheets.");
        }
      }

      if (googleEmail && googleKey && process.env.GOOGLE_SHEET_ID) {
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
          Instansi: (instansi && instansi.trim()) ? instansi.trim() : '-',
          WhatsApp: whatsapp,
          Email: (email && email.trim()) ? email.trim().toLowerCase() : '-',
          Keperluan: keperluan || '-',
          Menemui: menemui || '-',
          Kode: kodeBooking,
          Status: 'Pending',
          'Tanda Tangan': publicUrl,
          'Waktu Hadir': '-'
        });
        sheetsSaved = true;
      }
    } catch (sheetError) {
      console.error('Gagal menyimpan ke Google Sheets:', sheetError.message);
    }

    // 7. GENERATE QR CODE
    const qrCodeDataUrl = await QRCode.toDataURL(kodeBooking);

    // 8. KIRIM WHATSAPP VIA FONNTE
    try {
      let formattedWhatsapp = whatsapp.trim();
      if (formattedWhatsapp.startsWith('0')) {
        formattedWhatsapp = '62' + formattedWhatsapp.slice(1);
      } else if (formattedWhatsapp.startsWith('+')) {
        formattedWhatsapp = formattedWhatsapp.replace('+', '');
      }

      const formData = new URLSearchParams();
      formData.append('target', formattedWhatsapp);
      formData.append('message', `Halo *${nama}*,\n\nRegistrasi kamu di SowanQR berhasil! 🎉\n\nKode Booking: *${kodeBooking}*\n\nDengan keperluan untuk: ${keperluan || '-'}\nAkan menemui: ${menemui || '-'}\n\nSilakan tunjukkan QR Code yang muncul di website saat tiba di gerbang.\n\nTerima Kasih!`);

      const waResponse = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
          'Authorization': process.env.WA_GATEWAY_TOKEN
        },
        body: formData
      });

      const waResult = await waResponse.json();
      if (waResult.status === true) {
        waSent = true;
      }
      console.log('Respons dari Fonnte:', waResult);

    } catch (waError) {
      console.error('Gagal mengirim WhatsApp:', waError.message);
    }

    return NextResponse.json({
      success: true,
      qr: qrCodeDataUrl,
      code: kodeBooking,
      meta: {
        sheetsSaved,
        waSent
      }
    });

  } catch (error) {
    console.error('Error detail register:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}