import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req) {
  try {
    const { whatsapp, email, method, otpInput } = await req.json();

    if (!otpInput) {
      return NextResponse.json({ success: false, message: 'Kode OTP wajib diisi' }, { status: 400 });
    }

    // 1. Tentukan target identifier dan nama kolom pencarian secara dinamis
    let targetIdentifier = "";
    let searchColumn = "whatsapp"; // Default kolom whatsapp

    if (method === 'email') {
      if (!email) {
        return NextResponse.json({ success: false, message: 'Email tidak valid' }, { status: 400 });
      }
      targetIdentifier = email.trim().toLowerCase();
      searchColumn = "email"; // 🔥 Pindah ke kolom email jika metodenya email
    } else {
      if (!whatsapp) {
        return NextResponse.json({ success: false, message: 'Nomor WhatsApp tidak valid' }, { status: 400 });
      }
      let nomorWA = whatsapp.trim();
      if (nomorWA.startsWith('0')) nomorWA = '62' + nomorWA.slice(1);
      if (nomorWA.startsWith('+')) nomorWA = nomorWA.replace('+', '');
      targetIdentifier = nomorWA;
      searchColumn = "whatsapp";
    }

    console.log(`ℹ️ Memverifikasi OTP di kolom [${searchColumn}] untuk target: ${targetIdentifier}`);

    // 2. Ambil data OTP terakhir sesuai dengan kolom yang benar (whatsapp atau email)
    const { data, error } = await supabaseAdmin
      .from('otp_verification')
      .select('*')
      .eq(searchColumn, targetIdentifier) // 🔥 Menggunakan searchColumn yang dinamis
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return NextResponse.json({ success: false, message: 'Kode OTP tidak ditemukan atau belum dikirim' }, { status: 400 });
    }

    const otpData = data[0];

    // 3. Cek kedaluwarsa (5 menit)
    if (new Date() > new Date(otpData.expired_at)) {
      return NextResponse.json({ success: false, message: 'Kode OTP telah kedaluwarsa, silakan kirim ulang' }, { status: 400 });
    }

    // 4. Cek validitas kode
    if (String(otpData.otp_code) !== String(otpInput).trim()) {
      return NextResponse.json({ success: false, message: 'Kode OTP yang Anda masukkan salah' }, { status: 400 });
    }

    // 5. Bersihkan data OTP setelah sukses digunakan
    await supabaseAdmin
      .from('otp_verification')
      .delete()
      .eq(searchColumn, targetIdentifier);

    return NextResponse.json({ success: true, message: 'Verifikasi berhasil!' });

  } catch (error) {
    console.error('Error Verify OTP:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}