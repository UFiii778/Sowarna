import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

export async function POST(req) {
  try {
    const { kodeBooking } = await req.json();

    if (!kodeBooking) {
      return NextResponse.json({ success: false, message: 'Kode booking tidak valid' }, { status: 400 });
    }

    const { data: kunjungan, error: errKunjungan } = await supabaseAdmin
      .from('kunjungan_tamu')
      .select('*')
      .eq('kode', kodeBooking)
      .single();

    if (errKunjungan || !kunjungan) {
      console.log("🚨 KONDISI 1 PEMICU 404: Kode Booking tidak terdaftar di Supabase!", kodeBooking);
      return NextResponse.json({ success: false, message: 'Kunjungan tidak ditemukan atau kode salah' }, { status: 404 });
    }

    const { data: profil, error: errProfil } = await supabaseAdmin
      .from('profil_tamu')
      .select('*')
      .eq('nik', kunjungan.nik)
      .single();

    if (errProfil || !profil) {
      console.log("🚨 KONDISI 2 PEMICU 404: Profil tidak ditemukan");
      return NextResponse.json({ success: false, message: 'Profil tamu tidak ditemukan' }, { status: 404 });
    }

    const waktuSekarang = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

    const { error: errUpdateSupabase } = await supabaseAdmin
      .from('kunjungan_tamu')
      .update({
        status: 'Hadir',
        waktu_hadir: waktuSekarang
      })
      .eq('kode', kodeBooking);

    if (errUpdateSupabase) {
      throw new Error('Gagal memperbarui status di Supabase: ' + errUpdateSupabase.message);
    }

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
          const rows = await sheet.getRows();
          const rowToUpdate = rows.find(r => r.get('Kode') === kodeBooking);
          
          if (rowToUpdate) {
            rowToUpdate.set('Status', 'Hadir');
            rowToUpdate.set('Waktu Hadir', waktuSekarang);
            await rowToUpdate.save();
          } else {
            await sheet.addRow({
              'Kode': kodeBooking,
              'NIK': kunjungan.nik,
              'Nama': profil.nama,
              'WhatsApp': profil.whatsapp,
              'Keperluan': kunjungan.keperluan,
              'Menemui': kunjungan.menemui,
              'Status': 'Hadir',
              'Waktu Hadir': waktuSekarang,
              'Tanggal': new Date(kunjungan.created_at).toLocaleDateString('id-ID'),
              'Tanda Tangan': profil.tanda_tangan_url
            });
          }
        }
      }
    } catch (sheetErr) {
      console.error('Gagal memperbarui Google Sheets (tapi Supabase aman):', sheetErr.message);
    }

    try {
      if (process.env.FOONTE_TOKEN) {
        const pesanWA = `Halo ${profil.nama},\n\nKehadiran Anda berhasil dicatat oleh sistem SowanQR!\n\nKode: ${kodeBooking}\nMenemui: ${kunjungan.menemui}\nWaktu Hadir: ${waktuSekarang}\nStatus: Hadir\n\nTerima kasih telah melakukan pemindaian QR Code.`;

        await fetch('https://api.foonte.com/send', {
          method: 'POST',
          headers: {
            'Authorization': process.env.FOONTE_TOKEN
          },
          body: new URLSearchParams({
            'target': profil.whatsapp,
            'message': pesanWA
          })
        });
      }
    } catch (foonteErr) {
      console.error('Gagal mengirim WhatsApp via Foonte:', foonteErr.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Kehadiran berhasil dicatat',
      data: {
        nik: kunjungan.nik,
        nama: profil.nama,
        instansi: profil.instansi,
        whatsapp: profil.whatsapp,
        keperluan: kunjungan.keperluan,
        menemui: kunjungan.menemui,
        waktu_hadir: waktuSekarang,
        status: 'Hadir',
        tanda_tangan: profil.tanda_tangan
      }
    });

  } catch (err) {
    console.error(" SERVER ERROR AT API/SCAN:", err.message);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan internal server: ' + err.message }, { status: 500 });
  }
}