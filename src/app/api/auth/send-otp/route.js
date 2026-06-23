import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import nodemailer from 'nodemailer';

export async function POST(req) {
  try {
    const { whatsapp, email, method, purpose } = await req.json();

    // 1. NORMALISASI LOGIKA PURPOSE (LOGIN / REGISTER)
    let aksiUtama = 'register'; 
    const strPurpose = String(purpose || '').toLowerCase().trim();
    if (purpose === 0 || purpose === '0' || strPurpose === 'login' || strPurpose === 'masuk') {
      aksiUtama = 'login';
    }

    let nomorWA = whatsapp?.trim() || '';
    let targetEmail = email?.trim().toLowerCase() || '';

    if (nomorWA) {
      if (nomorWA.startsWith('0')) nomorWA = '62' + nomorWA.slice(1);
      if (nomorWA.startsWith('+')) nomorWA = nomorWA.replace('+', '');
    }

    const phoneRegex = /^62[0-9]{9,13}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // 2. VALIDASI INPUT
    if (aksiUtama === 'register') {
      if (!nomorWA) return NextResponse.json({ success: false, message: 'Nomor WhatsApp wajib diisi untuk registrasi' }, { status: 400 });
      if (!targetEmail) return NextResponse.json({ success: false, message: 'Alamat Email wajib diisi untuk registrasi' }, { status: 400 });
      if (!phoneRegex.test(nomorWA)) return NextResponse.json({ success: false, message: 'Format nomor WhatsApp tidak valid!' }, { status: 400 });
      if (!emailRegex.test(targetEmail)) return NextResponse.json({ success: false, message: 'Format alamat Email tidak valid!' }, { status: 400 });

    } else if (aksiUtama === 'login') {
      if (method === 'whatsapp') {
        if (!nomorWA) return NextResponse.json({ success: false, message: 'Nomor WhatsApp wajib diisi untuk login via WA' }, { status: 400 });
        if (!phoneRegex.test(nomorWA)) return NextResponse.json({ success: false, message: 'Format nomor WhatsApp tidak valid!' }, { status: 400 });
      } else if (method === 'email') {
        if (!targetEmail) return NextResponse.json({ success: false, message: 'Alamat Email wajib diisi untuk login via Email' }, { status: 400 });
        if (!emailRegex.test(targetEmail)) return NextResponse.json({ success: false, message: 'Format alamat Email tidak valid!' }, { status: 400 });
      }
    }

    // 3. LOGIKA PENCARIAN DATABASE
    if (aksiUtama === 'register') {
      const nomorWAAlternatif = nomorWA.startsWith('62') ? '0' + nomorWA.slice(2) : '62' + nomorWA.slice(1);
      
      const { data: existingUser, error: checkError } = await supabaseAdmin
        .from('profil_tamu')
        .select('id, whatsapp, email')
        .or(`whatsapp.eq.${nomorWA},whatsapp.eq.${nomorWAAlternatif},email.eq.${targetEmail}`)
        .maybeSingle();

      if (checkError) return NextResponse.json({ success: false, message: 'Gagal memvalidasi data pendaftaran.' }, { status: 500 });

      if (existingUser) {
        const isWaDuplicate = existingUser.whatsapp === nomorWA || existingUser.whatsapp === nomorWAAlternatif;
        const isEmailDuplicate = existingUser.email === targetEmail;
        let pesanError = 'Data akun sudah terdaftar.';
        if (isWaDuplicate && isEmailDuplicate) pesanError = 'Nomor WhatsApp dan Email tersebut sudah terdaftar!';
        else if (isWaDuplicate) pesanError = 'Nomor WhatsApp tersebut sudah terdaftar!';
        else if (isEmailDuplicate) pesanError = 'Alamat Email tersebut sudah terdaftar!';
        return NextResponse.json({ success: false, message: pesanError }, { status: 400 });
      }

    } else if (aksiUtama === 'login') {
      let query = supabaseAdmin.from('profil_tamu').select('id, whatsapp, email');
      
      if (method === 'whatsapp') {
        const nomorWAAlternatif = nomorWA.startsWith('62') ? '0' + nomorWA.slice(2) : '62' + nomorWA.slice(1);
        query = query.or(`whatsapp.eq.${nomorWA},whatsapp.eq.${nomorWAAlternatif}`);
      } else if (method === 'email') {
        query = query.eq('email', targetEmail);
      }

      const { data: userExist, error: loginCheckError } = await query.maybeSingle();

      if (loginCheckError) {
        return NextResponse.json({ success: false, message: 'Gagal memvalidasi akun login.' }, { status: 500 });
      }

      if (!userExist) {
        return NextResponse.json({ 
          success: false, 
          message: method === 'email' ? 'Alamat Email belum terdaftar!' : 'Nomor WhatsApp belum terdaftar!' 
        }, { status: 400 });
      }

      nomorWA = userExist.whatsapp || nomorWA;
      targetEmail = userExist.email || targetEmail;
    }

    // 🔥 CRITICAL FIX 1: Paksa nomorWA kembali ke format internasional '62' sebelum masuk ke proses OTP
    if (nomorWA) {
      nomorWA = nomorWA.trim();
      if (nomorWA.startsWith('0')) nomorWA = '62' + nomorWA.slice(1);
      if (nomorWA.startsWith('+')) nomorWA = nomorWA.replace('+', '');
    }

    // 🔥 CRITICAL FIX 2: SISTEM REUSE OTP (ANTI DOUBLE-TRIGGER)
    // Cek apakah ada request OTP aktif yang baru dikirim kurang dari 45 detik yang lalu
    const { data: recentOtp } = await supabaseAdmin
      .from('otp_verification')
      .select('*')
      .eq(method === 'email' ? 'email' : 'whatsapp', method === 'email' ? targetEmail : nomorWA)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let kodeOTP;
    let expiredAt;

    if (recentOtp && (Date.now() - Date.parse(recentOtp.created_at)) < 45000) {
      // ♻️ Jika terpicu dua kali, gunakan kembali kode pertama yang sukses masuk database
      kodeOTP = recentOtp.otp_code;
      expiredAt = recentOtp.expired_at;
      console.log(`♻️ [ANTI DOUBLE-TRIGGER] Menggunakan kembali kode OTP lama: ${kodeOTP}`);
    } else {
      // Jika request murni baru, bersihkan OTP usang milik user ini agar steril
      await supabaseAdmin
        .from('otp_verification')
        .delete()
        .eq(method === 'email' ? 'email' : 'whatsapp', method === 'email' ? targetEmail : nomorWA);

      // Buat kode OTP baru
      kodeOTP = String(Math.floor(1000 + Math.random() * 9000));
      expiredAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      const { error: dbError } = await supabaseAdmin
        .from('otp_verification')
        .insert([{
          whatsapp: nomorWA || null,
          email: targetEmail || null,
          otp_code: kodeOTP,
          expired_at: expiredAt
        }]);

      if (dbError) {
        console.error("❌ [SUPABASE OTP INSERT ERROR]:", dbError.message);
        throw new Error('Gagal menyimpan OTP ke database');
      }
    }

    // 5. PROSES PENGIRIMAN OTP
    if (method === 'whatsapp') {
      const tokenFoonte = process.env.FOONTE_TOKEN;
      if (!tokenFoonte) return NextResponse.json({ success: false, message: 'Server configuration error (Token Missing)' }, { status: 500 });

      const formData = new URLSearchParams();
      formData.append('target', nomorWA);
      formData.append('message', `*KODE VERIFIKASI SOWANQR*\n\nKode OTP Anda adalah: *${kodeOTP}*\n\nKode ini berlaku selama 5 menit. Jangan bagikan kode ini kepada siapa pun.\n\nTerima Kasih!`);

      const fonnteResponse = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { 'Authorization': tokenFoonte, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
      });

      const fonnteResult = await fonnteResponse.json();
      if (!fonnteResult.status) {
        return NextResponse.json({ success: false, message: `Fonnte gagal mengirim pesan: ${fonnteResult.reason || 'Unknown'}` }, { status: 400 });
      }

    } else if (method === 'email' && targetEmail) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.SMTP_EMAIL, pass: process.env.SMTP_PASSWORD },
      });

      await transporter.sendMail({
        from: `"SowanQR System" <${process.env.SMTP_EMAIL}>`,
        to: targetEmail,
        subject: 'Kode Verifikasi OTP SowanQR',
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; max-w-md; margin: auto;">
            <h2 style="color: #00BFFF; text-align: center;">KODE VERIFIKASI SOWANQR</h2>
            <p>Halo, terima kasih telah melakukan verifikasi. Berikut adalah kode OTP Anda:</p>
            <div style="background: #f3f4f6; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center; border-radius: 8px; color: #1f2937; margin: 20px 0;">
              ${kodeOTP}
            </div>
            <p style="font-size: 12px; color: #6b7280; text-align: center;">Kode ini berlaku selama 5 menit. Mohon jangan sebarkan kode ini.</p>
          </div>
        `,
      });
    }

    return NextResponse.json({ success: true, message: 'OTP berhasil dikirim' });

  } catch (error) {
    console.error("💥 [CRASH DETECTED IN SEND-OTP]:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}