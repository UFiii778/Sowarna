import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req) {
  try {
    const { kode } = await req.json();

    if (!kode || kode.trim() === '') {
      return NextResponse.json({ success: false, message: 'Kode QR tidak valid atau kosong' }, { status: 400 });
    }

    const { data: kunjungan, error: fetchError } = await supabaseAdmin
      .from('kunjungan_tamu')
      .select(`
        *,
        profil_tamu ( nama )
      `)
      .eq('kode', kode.trim())
      .maybeSingle();

    if (fetchError) {
      console.error("Database Fetch Error:", fetchError.message);
      return NextResponse.json({ success: false, message: 'Gagal membaca data dari server' }, { status: 500 });
    }

    // Jika kode QR tidak ada di database sama sekali
    if (!kunjungan) {
      return NextResponse.json({ success: false, message: 'QR Code tidak terdaftar atau tidak dikenali' }, { status: 404 });
    }

    const namaTamu = kunjungan.profil_tamu?.nama || 'Tamu';
    const waktuSekarang = new Date().toISOString();


    if (!kunjungan.jam_masuk) {
      const { error: updateInError } = await supabaseAdmin
        .from('kunjungan_tamu')
        .update({
          jam_masuk: waktuSekarang,
          status: 'Hadir' // Mengubah status menjadi Hadir / Masuk
        })
        .eq('kode', kode.trim());

      if (updateInError) throw new Error(updateInError.message);

      return NextResponse.json({
        success: true,
        type: 'check-in',
        message: `Selamat datang, ${namaTamu}! Check-in berhasil tercatat.`,
        nama: namaTamu,
        jam: new Date(waktuSekarang).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      });
    }

    if (kunjungan.jam_masuk && !kunjungan.jam_keluar) {
      const { error: updateOutError } = await supabaseAdmin
        .from('kunjungan_tamu')
        .update({
          jam_keluar: waktuSekarang,
          status: 'Selesai' // Mengubah status menjadi Selesai / Keluar
        })
        .eq('kode', kode.trim());

      if (updateOutError) throw new Error(updateOutError.message);

      return NextResponse.json({
        success: true,
        type: 'check-out',
        message: `Terima kasih atas kunjungannya, ${namaTamu}. Check-out berhasil tercatat!`,
        nama: namaTamu,
        jam: new Date(waktuSekarang).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      });
    }

    if (kunjungan.jam_masuk && kunjungan.jam_keluar) {
      return NextResponse.json({
        success: false,
        type: 'expired',
        message: `QR Code milik ${namaTamu} sudah kedaluwarsa (Tamu sudah melakukan Check-out sebelumnya).`
      }, { status: 400 });
    }

  } catch (error) {
    console.error("🔴 ERROR AT SCANNER BACKEND:", error.message);
    return NextResponse.json({ success: false, message: 'Internal Server Error: ' + error.message }, { status: 500 });
  }
}