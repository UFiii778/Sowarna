import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const data = await request.json();

        // ================= 1. PROSES KIRIM KE GOOGLE SHEETS =================
        const authUrl = 'https://oauth2.googleapis.com/token';
        const jwtHeader = b64e(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
        const now = Math.floor(Date.now() / 1000);

        const jwtClaim = b64e(JSON.stringify({
            iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            scope: 'https://www.googleapis.com/auth/spreadsheets',
            aud: authUrl,
            exp: now + 3600,
            iat: now
        }));

        // Melakukan penandatanganan JWT sederhana menggunakan bantuan crypto bawaan Node.js
        const crypto = require('crypto');
        const sign = crypto.createSign('RSA-SHA256');
        sign.update(`${jwtHeader}.${jwtClaim}`);
        const jwtSignature = sign.sign(process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), 'base64')
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        const tokenJwt = `${jwtHeader}.${jwtClaim}.${jwtSignature}`;

        // Tukar JWT dengan Access Token Google
        const tokenRes = await fetch(authUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${tokenJwt}`
        });
        const tokenData = await tokenRes.json();

        if (tokenData.access_token) {
            // Append data baris baru ke Google Sheets
            await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}/values/A1:append?valueInputOption=USER_ENTERED`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${tokenData.access_token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        values: [[
                            data.created_at,
                            data.nik,
                            data.nama,
                            data.instansi,
                            data.whatsapp,
                            data.keperluan,
                            data.menemui,
                            data.kode,
                            data.status,
                            data.waktu_hadir
                        ]]
                    })
                }
            );
        }

        // ================= 2. PROSES KIRIM NOTIFIKASI FOONTE =================
        const pesanWhatsapp =
            `Halo *${data.nama}*, 
Kunjungan baru Anda berhasil dibuat! ✨

📋 *Detail Kunjungan:*
• Kode Booking: ${data.kode}
• Keperluan: ${data.keperluan}
• Menemui: ${data.menemui}
• Status: Menunggu Scan

Silakan tunjukkan QR Code pada dashboard Anda kepada petugas saat tiba di lokasi. Terima kasih.`;

        await fetch('https://api.foonte.com/send', {
            method: 'POST',
            headers: {
                'Authorization': process.env.FOONTE_TOKEN
            },
            body: new URLSearchParams({
                'target': data.whatsapp,
                'message': pesanWhatsapp,
                'countryCode': '62'
            })
        });

        return NextResponse.json({ success: true, message: 'Google Sheets & WA Berhasil Terkirim' });

    } catch (error) {
        console.error("Error di API Booking:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// Fungsi pembantu enkripsi base64 url
function b64e(str) {
    return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}