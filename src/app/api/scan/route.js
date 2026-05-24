import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

export async function POST(req) {
  try {
    const { kodeBooking } = await req.json();

    if (!kodeBooking) {
      return NextResponse.json({ success: false, message: 'Kode booking tidak valid' }, { status: 400 });
    }

    const { data: kunjungan, error: errKunjungan } = await supabase
      .from('kunjungan_tamu')
      .select('*')
      .eq('kode', kodeBooking)
      .single();

    if (errKunjungan || !kunjungan) {
      console.log("🚨 KONDISI 1 PEMICU 404: Kode Booking tidak terdaftar di Supabase!", kodeBooking);
      return NextResponse.json({ success: false, message: 'Kunjungan tidak ditemukan atau kode salah' }, { status: 404 });
    }

    const { data: profil, error: errProfil } = await supabase
      .from('profil_tamu')
      .select('*')
      .eq('nik', kunjungan.nik)
      .single();

    if (errProfil || !profil) {
      console.log("🚨 KONDISI 2 PEMICU 404: Kunjungan ada, tapi NIK ini tidak punya profil!", kunjungan.nik);
      return NextResponse.json({ success: false, message: 'Profil pemilik QR tidak ditemukan' }, { status: 404 });
    }

    // Buat format jam hadir saat ini (WIB)
    const waktuSekarang = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

    // Jika tamu sudah pernah di-scan sebelumnya (status sudah Hadir)
    if (kunjungan.status === 'Hadir') {
      // kembalikan datanya, namun beri tahu admin kalau ini sudah pernah absen
      return NextResponse.json({
        success: false,
        message: 'QR Code ini sudah pernah di-scan sebelumnya!',
        data: {
          nik: kunjungan.nik,
          nama: profil.nama,
          instansi: profil.instansi,
          whatsapp: profil.whatsapp,
          keperluan: kunjungan.keperluan,
          menemui: kunjungan.menemui,
          waktu_hadir: kunjungan.waktu_hadir
        }
      });
    }

    const { error: updateError } = await supabase
      .from('kunjungan_tamu')
      .update({
        status: 'Hadir',
        waktu_hadir: waktuSekarang
      })
      .eq('id', kunjungan.id);

    if (updateError) {
      throw new Error('Gagal memperbarui status kehadiran di database');
    }

    try {
      let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
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
          rowToUpdate.set('Status', 'Hadir');
          rowToUpdate.set('Waktu Hadir', waktuSekarang);
          await rowToUpdate.save();
        }
      }
    } catch (sheetErr) {
      console.error('Gagal memperbarui Google Sheets (tapi Supabase aman):', sheetErr.message);
    }

    // Kembalikan paket data gabungan yang sukses untuk ditampilkan admin
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
        waktu_hadir: waktuSekarang
      }
    });

  } catch (error) {
    console.error('Error API Scan:', error.message);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan internal server' }, { status: 500 });
  }
}