import { NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabase';

export async function POST(req) {
  try {
    const { nama, nik, whatsapp, keperluan, menemui, isVerifying } = await req.json();

    // LANGKAH A: Cek apakah data profil tamu terdaftar (Dipakai saat user ketik NIK di form login)
    if (isVerifying) {
      const { data: profil, error } = await supabase
        .from('profil_tamu')
        .select('*')
        .eq('nik', nik)
        .eq('whatsapp', whatsapp)
        .single();

      if (error || !profil) {
        return NextResponse.json({ success: false, message: 'Data tidak ditemukan. Silakan Register terlebih dahulu.' });
      }
      return NextResponse.json({ success: true, profil });
    }

    // LANGKAH B: Jika profil terverifikasi, langsung buatkan baris kunjungan baru
    const kodeBooking = `SQ-${Date.now()}`;

    const { data: profil } = await supabase.from('profil_tamu').select('*').eq('nik', nik).single();

    const { error: kunjunganError } = await supabase
      .from('kunjungan_tamu')
      .insert([{
        nama, nik, keperluan, menemui,
        kode: kodeBooking,
        status: 'Pending',
        waktu_hadir: '-'
      }]);

    if (kunjunganError) throw kunjunganError;

    const auth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];

    await sheet.addRow({
      NIK: nik,
      Nama: profil.nama,
      WhatsApp: profil.whatsapp,
      Email: profil.email,
      Keperluan: keperluan,
      Menemui: menemui,
      Kode: kodeBooking,
      Status: 'Pending',
      'Tanda Tangan': profil.tanda_tangan
    });

    const qrCodeDataUrl = await QRCode.toDataURL(kodeBooking);
    return NextResponse.json({ success: true, qr: qrCodeDataUrl, code: kodeBooking });

  } catch (error) {
    console.error('Login Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}