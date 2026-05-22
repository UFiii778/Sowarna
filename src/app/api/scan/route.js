// src/app/api/scan/route.js
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req) {
  try {
    const { kodeBooking } = await req.json();

    // 1. Cari data tamu berdasarkan kodeBooking
    const { data: tamu, error: fetchError } = await supabase
      .from('tamu')
      .select('*')
      .eq('kode', kodeBooking)
      .single();

    if (fetchError || !tamu) {
      return NextResponse.json({ success: false, message: 'Kode QR tidak valid atau tidak ditemukan!' }, { status: 404 });
    }

    if (tamu.status === 'Hadir') {
      return NextResponse.json({ success: false, message: 'Tamu ini sudah melakukan scan sebelumnya!', data: tamu });
    }

    // 2. Ambil waktu lokal saat ini (WIB)
    const waktuSekarang = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

    // 3. Update status tamu menjadi Hadir di Supabase
    const { error: updateError } = await supabase
      .from('tamu')
      .update({ status: 'Hadir', waktu_hadir: waktuSekarang })
      .eq('kode', kodeBooking);

    if (updateError) throw updateError;

    const dataTerbaru = { ...tamu, status: 'Hadir', waktu_hadir: waktuSekarang };

    return NextResponse.json({
      success: true,
      message: 'Berhasil melakukan konfirmasi kehadiran!',
      data: dataTerbaru
    });

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}