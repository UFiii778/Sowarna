import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req) {
  try {
    const { whatsapp, email, method, otpInput } = await req.json();

    if (!otpInput) {
      return NextResponse.json({ success: false, message: 'Kode OTP wajib diisi' }, { status: 400 });
    }

    let targetIdentifier = "";
    let searchColumn = "whatsapp"; 

    if (method === 'email') {
      if (!email) {
        return NextResponse.json({ success: false, message: 'Email tidak valid' }, { status: 400 });
      }
      targetIdentifier = email.trim().toLowerCase();
      searchColumn = "email"; 
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

    console.log(`[VERIFIKASI] Mencari OTP di kolom [${searchColumn}] untuk target: ${targetIdentifier}`);

    const { data, error } = await supabaseAdmin
      .from('otp_verification')
      .select('*')
      .eq(searchColumn, targetIdentifier) 
      .order('created_at', { ascending: false })
      .limit(1);

    console.log("[DEBUG DB RESULT]:", { error, data });

    if (error || !data || data.length === 0) {
      return NextResponse.json({ success: false, message: 'Kode OTP tidak ditemukan atau belum dikirim' }, { status: 400 });
    }

    const otpData = data[0];

    console.log("[DEBUG MATCHING OTP]:", {
      otpDariUser: String(otpInput).trim(),
      otpDiDatabase: String(otpData.otp_code).trim(),
      apakahCocok: String(otpData.otp_code) === String(otpInput).trim()
    });

    if (String(otpData.otp_code) === String(otpInput).trim()) {
      
      await supabaseAdmin
        .from('otp_verification')
        .delete()
        .eq('id', otpData.id);

   
      let userNikDariDatabase = null;

      let nomorWA0 = targetIdentifier;
      let nomorWA62 = targetIdentifier;
      if (targetIdentifier.startsWith('0')) {
        nomorWA62 = '62' + targetIdentifier.slice(1);
      } else if (targetIdentifier.startsWith('62')) {
        nomorWA0 = '0' + targetIdentifier.slice(2);
      }

      let profilQuery = supabaseAdmin.from('profil_tamu').select('nik');

      if (searchColumn === 'email') {
        profilQuery = profilQuery.eq('email', targetIdentifier);
      } else {
        profilQuery = profilQuery.or(`whatsapp.eq.${nomorWA62},whatsapp.eq.${nomorWA0}`);
      }

      const { data: profil } = await profilQuery.maybeSingle();

      if (profil) {
        userNikDariDatabase = profil.nik;
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Verifikasi OTP Berhasil!',
        nik: userNikDariDatabase 
      });

    } else {
      return NextResponse.json({ success: false, message: 'Kode OTP yang Anda masukkan salah' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error detail verify-otp:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}