// src/app/admin/page.js
'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function AdminDashboard() {
    const [historyTamu, setHistoryTamu] = useState([]);
    const [scanResult, setScanResult] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const scannerRef = useRef(null);

    // 1. Ambil data awal dan aktifkan Real-time Listener Supabase
    useEffect(() => {
        const fetchTamu = async () => {
            const { data } = await supabase
                .from('tamu')
                .select('*')
                .order('id', { ascending: false });
            if (data) setHistoryTamu(data);
        };

        fetchTamu();

        // Listener Real-time: Jika ada insert/update di Supabase, langsung perbarui UI dashboard
        const channel = supabase
            .channel('schema-db-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tamu' }, () => {
                fetchTamu();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // 2. Inisialisasi Kamera QR Scanner saat halaman dibuka
    useEffect(() => {
        const scanner = new Html5QrcodeScanner('reader', {
            fps: 10,
            qrbox: { width: 250, height: 250 },
        });

        scanner.render(async (decodedText) => {
            // Jika berhasil men-scan teks/kode QR
            try {
                setErrorMsg('');
                const res = await fetch('/api/scan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ kodeBooking: decodedText })
                });
                const result = await res.json();

                if (result.success) {
                    setScanResult(result.data);
                } else {
                    setErrorMsg(result.message);
                    if (result.data) setScanResult(result.data); // Tetap tampilkan detail walau sudah hadir
                }
            } catch (err) {
                setErrorMsg('Gagal memproses QR Code');
            }
        }, (error) => {
            // Pembacaan QR biasa sedang mencari gambar (abaikan log error pencarian)
        });

        return () => {
            scanner.clear().catch(err => console.error("Gagal clear scanner", err));
        };
    }, []);

    return (
        <main className="min-h-screen bg-slate-900 text-white p-6">
            {/* Header */}
            <div className="mb-8 border-b border-slate-800 pb-4">
                <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
                    SowanQR Admin Dashboard
                </h1>
                <p className="text-slate-400 text-sm mt-1">Sistem Pemantauan & Scan Kehadiran Tamu Real-time</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* KOLOM KIRI: SCANNER & HASIL NIK (4 COLS) */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl shadow-xl">
                        <h2 className="text-lg font-bold mb-4 text-indigo-400"> Scan QR Code Tamu</h2>
                        {/* Kamera Render Target */}
                        <div id="reader" className="overflow-hidden rounded-xl bg-slate-900 border border-slate-700"></div>
                    </div>

                    {/* Dinamis Teks Sesuai Permintaan Guru (Contoh History Sukses) */}
                    {scanResult && (
                        <div className={`p-6 rounded-2xl border transition-all ${errorMsg ? 'bg-amber-500/10 border-amber-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
                            <h3 className={`text-md font-bold mb-2 ${errorMsg ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {errorMsg ? 'ℹ️ Informasi Tamu' : '🎉 Tamu Berhasil Hadir!'}
                            </h3>
                            <p className="text-sm leading-relaxed text-slate-200 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                                " Nama <span className="text-cyan-400 font-bold">{scanResult.nama}</span> no <span className="text-cyan-400 font-bold">{scanResult.whatsapp}</span> NIK <span className="text-cyan-400 font-bold">{scanResult.nik || '-'}</span> dari sekolah/instansi <span className="text-cyan-400 font-bold">{scanResult.instansi}</span> hadir untuk keperluan <span className="text-cyan-400 font-bold">{scanResult.keperluan || '-'}</span> dan menemui dengan <span className="text-cyan-400 font-bold">{scanResult.menemui || '-'}</span> pada pukul <span className="text-emerald-400 font-bold">{scanResult.waktu_hadir}</span> "
                            </p>
                            {errorMsg && <p className="text-xs text-amber-400 mt-2 font-medium">* {errorMsg}</p>}
                        </div>
                    )}
                </div>

                {/* KOLOM KANAN: TABEL REKAP KEHADIRAN (7 COLS) */}
                <div className="lg:col-span-7">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl overflow-hidden">
                        <h2 className="text-lg font-bold mb-4 text-cyan-400">📋 Daftar Riwayat Pendaftaran & Kehadiran</h2>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-700 text-slate-400 text-sm font-semibold">
                                        <th className="py-3 px-4">Nama / NIK</th>
                                        <th className="py-3 px-4">Instansi & Keperluan</th>
                                        <th className="py-3 px-4">Menemui</th>
                                        <th className="py-3 px-4">Status</th>
                                        <th className="py-3 px-4">Waktu</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800 text-sm">
                                    {historyTamu.map((tamu) => (
                                        <tr key={tamu.id} className="hover:bg-slate-700/30 transition-colors">
                                            <td className="py-3.5 px-4">
                                                <div className="font-bold text-slate-200">{tamu.nama}</div>
                                                <div className="text-xs text-slate-500 font-mono">NIK: {tamu.nik || '-'}</div>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <div className="text-slate-300">{tamu.instansi}</div>
                                                <div className="text-xs text-indigo-300 italic">Perlu: {tamu.keperluan || '-'}</div>
                                            </td>
                                            <td className="py-3.5 px-4 text-slate-300 font-medium">{tamu.menemui || '-'}</td>
                                            <td className="py-3.5 px-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${tamu.status === 'Hadir'
                                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                                    }`}>
                                                    {tamu.status}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-slate-400 font-mono text-xs">{tamu.waktu_hadir || '-'}</td>
                                        </tr>
                                    ))}
                                    {historyTamu.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="text-center py-8 text-slate-500 font-medium">Belum ada data pendaftar tamu.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

            </div>
        </main>
    );
}