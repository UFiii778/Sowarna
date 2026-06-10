import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import nodemailer from 'nodemailer';

export async function POST(req) {
  try {
    const { whatsapp, email, method } = await req.json();

    if (!whatsapp) {
      return NextResponse.json({ success: false, message: 'Nomor WhatsApp wajib diisi' }, { status: 400 });
    }

    let nomorWA = whatsapp.trim();
    if (nomorWA.startsWith('0')) nomorWA = '62' + nomorWA.slice(1);
    if (nomorWA.startsWith('+')) nomorWA = nomorWA.replace('+', '');

    const kodeOTP = String(Math.floor(1000 + Math.random() * 9000));
    const expiredAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { error: dbError } = await supabaseAdmin
      .from('otp_verification')
      .insert([{ 
        whatsapp: nomorWA, 
        email: email ? email.trim().toLowerCase() : null, 
        otp_code: kodeOTP, 
        expired_at: expiredAt 
      }]);

    if (dbError) {
      console.error("❌ [SUPABASE ERROR]:", dbError.message);
      throw new Error('Gagal menyimpan OTP ke database');
    }

    if (method === 'whatsapp') {
      const tokenFoonte = process.env.FOONTE_TOKEN;
      
      if (!tokenFoonte) {
        console.error("❌ [FONNTE ERROR]: FOONTE_TOKEN belum dipasang di env!");
        return NextResponse.json({ success: false, message: 'Server configuration error (Token Missing)' }, { status: 500 });
      }

      const formData = new URLSearchParams();
      formData.append('target', nomorWA);
      formData.append('message', `*KODE VERIFIKASI SOWANQR*\n\nKode OTP Anda adalah: *${kodeOTP}*\n\nKode ini berlaku selama 5 menit. Jangan bagikan kode ini kepada siapa pun.\n\nTerima Kasih!`);

      console.log(`🔗 Mengirim WhatsApp OTP ke ${nomorWA}...`);

      const fonnteResponse = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { 
          'Authorization': tokenFoonte,
          'Content-Type': 'application/x-www-form-urlencoded' 
        },
        body: formData
      });

      const fonnteResult = await fonnteResponse.json();
      console.log("📨 [FONNTE RESPONSE]:", fonnteResult);

      // Jika Fonnte merespon tapi status pengiriman internalnya gagal (false)
      if (!fonnteResult.status) {
        return NextResponse.json({ 
          success: false, 
          message: `Fonnte gagal mengirim pesan: ${fonnteResult.reason || 'Unknown Reason'}` 
        }, { status: 400 });
      }

    } else if (method === 'email' && email) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.SMTP_EMAIL, 
          pass: process.env.SMTP_PASSWORD,
        },
      });

       await transporter.sendMail({
        from: `"SowanQR System" <${process.env.SMTP_EMAIL}>`,
        to: email.trim(),
        subject: 'Kode Verifikasi OTP SowanQR',
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; max-w-md; margin: auto;">
            <h2 style="color: #00BFFF; text-align: center;">KODE VERIFIKASI SOWANQR</h2>
            <p>Halo, terima kasih telah melakukan registrasi kunjungan. Berikut adalah kode OTP Anda:</p>
            <div style="background: #f3f4f6; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center; border-radius: 8px; color: #1f2937; margin: 20px 0;">
              ${kodeOTP}
            </div>
            <p style="font-size: 12px; color: #6b7280; text-align: center;">Kode ini berlaku selama 60 detik. Mohon jangan sebarkan kode ini.</p>
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