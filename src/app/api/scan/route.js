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

    // Cari profil tamu berdasarkan NIK kunjungan
    const { data: profil, error: errProfil } = await supabaseAdmin
      .from('profil_tamu')
      .select('*')
      .eq('nik', kunjungan.nik)
      .single();

    if (errProfil || !profil) {
      console.log("🚨 KONDISI 2 PEMICU 404: Profil tidak ditemukan");
      return NextResponse.json({ success: false, message: 'Profil tamu tidak ditemukan' }, { status: 404 });
    }

    // Mengeset waktu lokal WIB Indonesia
    const waktuSekarang = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

    // Update status kehadiran di Supabase
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
        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();

        const rowToUpdate = rows.find(r => r.get('Kode') === kodeBooking);
        if (rowToUpdate) {
          rowToUpdate.set('nama', profil?.nama || '-');
          rowToUpdate.set('instansi', profil?.instansi || '-');
          rowToUpdate.set('whatsapp', profil?.whatsapp || '-');
          
          rowToUpdate.set('Status', 'Hadir');
          rowToUpdate.set('Waktu Hadir', waktuSekarang);
          await rowToUpdate.save();
        }
      }
    } catch (sheetErr) {
      console.error('Gagal memperbarui Google Sheets (tetapi Supabase aman):', sheetErr.message);
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
        status: 'Hadir'
      }
    });

  } catch (err) {
    console.error("🚨 SERVER ERROR AT API/SCAN:", err.message);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan internal server: ' + err.message }, { status: 500 });
  }
}