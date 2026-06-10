import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req) {
  try {
    const { whatsapp, email } = await req.json();

    if (!whatsapp || !email) {
      return NextResponse.json({
        success: false,
        message: 'Email dan Nomor WhatsApp wajib diisi'
      }, { status: 400 });
    }

    // 1. Buat dua variasi format WhatsApp (08... dan 62...) untuk dicocokkan ke Database
    let nomorWA = whatsapp.trim();
    if (nomorWA.startsWith('+')) nomorWA = nomorWA.replace('+', '');

    let nomorWA62 = nomorWA;
    let nomorWA0 = nomorWA;

    if (nomorWA.startsWith('0')) {
      nomorWA62 = '62' + nomorWA.slice(1);
    } else if (nomorWA.startsWith('62')) {
      nomorWA0 = '0' + nomorWA.slice(2);
    }

    const targetEmail = email.trim().toLowerCase();

    // 2. Cek ke database menggunakan klausa .or() agar mendeteksi kedua format nomor
    const { data: user, error: userError } = await supabaseAdmin
      .from('profil_tamu')
      .select('*')
      .eq('email', targetEmail)
      .or(`whatsapp.eq.${nomorWA62},whatsapp.eq.${nomorWA0}`)
      .maybeSingle();

    if (userError) {
      console.error("Supabase Login Error:", userError.message);
      return NextResponse.json({ success: false, message: 'Terjadi kesalahan sistem database' }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({
        success: false,
        message: 'Kombinasi Email dan Nomor WhatsApp tidak ditemukan. Silakan periksa kembali data Anda atau daftar baru.'
      }, { status: 404 });
    }

    // Jika sukses, kembalikan data user beserta nomor whatsapp asli yang terdaftar di DB
    return NextResponse.json({
      success: true,
      message: 'Data terverifikasi, silakan lanjutkan ke verifikasi OTP.',
      nik: user.nik,       // Menyediakan nik di root level
      profil: user         // Menyediakan object profil untuk kecocokan kode frontend lama
    });

  } catch (error) {
    console.error("Login Route Error:", error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan server internal' }, { status: 500 });
  }
}