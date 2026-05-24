'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';

export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState('kunjungan');

    const [historyKunjungan, setHistoryKunjungan] = useState([]);
    const [historyProfil, setHistoryProfil] = useState([]);
    const [scanResult, setScanResult] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');

    const [showAnimation, setShowAnimation] = useState(false);
    const [animationType, setAnimationType] = useState('success'); // 'success' atau 'error'

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedData, setSelectedData] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [editForm, setEditForm] = useState({});

    const fetchKunjungan = async () => {
        const { data, error } = await supabase
            .from('kunjungan_tamu')
            .select(`
            *,
            profil_tamu (
                nama
            )
        `)
            .order('id', { ascending: false });

        if (error) {
            console.error("Gagal mengambil data kunjungan:", error.message);
        } else if (data) {
            setHistoryKunjungan(data);
        }
    };

    const fetchProfil = async () => {
        const { data } = await supabase
            .from('profil_tamu')
            .select('*')
            .order('id', { ascending: false });
        if (data) setHistoryProfil(data);
    };

    const refreshAllData = () => {
        fetchKunjungan();
        fetchProfil();
    };

    useEffect(() => {
        refreshAllData();

        const channelKunjungan = supabase
            .channel('realtime-kunjungan')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'kunjungan_tamu' },
                async (payload) => {
                    await fetchKunjungan();
                }
            )
            .subscribe();

        const channelProfil = supabase
            .channel('realtime-profil')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'profil_tamu' },
                async (payload) => {
                    await fetchProfil();
                    await fetchKunjungan();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channelKunjungan);
            supabase.removeChannel(channelProfil);
        };
    }, []);

    useEffect(() => {
        const scanner = new Html5QrcodeScanner('reader', {
            fps: 10,
            qrbox: { width: 250, height: 250 },
        });

        scanner.render(async (decodedText) => {
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
                    setAnimationType('success');
                    setShowAnimation(true);
                    setTimeout(() => setShowAnimation(false), 2500);
                } else {
                    setErrorMsg(result.message);
                    if (result.data) setScanResult(result.data);
                    setAnimationType('error');
                    setShowAnimation(true);
                    setTimeout(() => setShowAnimation(false), 2500);
                }
            } catch (err) {
                setErrorMsg('Gagal memproses QR Code');
                setAnimationType('error');
                setShowAnimation(true);
                setTimeout(() => setShowAnimation(false), 2500);
            }
        }, (error) => {
        });

        return () => {
            scanner.clear().catch(err => console.error("Gagal clear scanner", err));
        };
    }, []);

    const openEditModal = (data) => {
        setSelectedData(data);
        if (activeTab === 'kunjungan' || activeTab === 'hadir') {
            setEditForm({
                nik: data.nik || '',
                keperluan: data.keperluan || '',
                menemui: data.menemui || '',
                status: data.status || 'Pending',
                waktu_hadir: data.waktu_hadir || '-'
            });
        } else {
            setEditForm({
                nik: data.nik || '',
                nama: data.nama || '',
                instansi: data.instansi || '',
                whatsapp: data.whatsapp || '',
                email: data.email || ''
            });
        }
        setIsEditModalOpen(true);
    };

    // Scanner Unggah Berkas Gambar dengan Pemicu Animasi Pop-up
    const handleFileScan = async (file) => {
        const element = document.getElementById("reader");
        if (!element) {
            setErrorMsg('Elemen scanner tidak ditemukan di layar.');
            return;
        }

        const html5QrCode = new Html5Qrcode("reader");
        try {
            const decodedText = await html5QrCode.scanFile(file, true);

            const res = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kodeBooking: decodedText })
            });
            const result = await res.json();

            if (result.success) {
                setScanResult(result.data);
                setErrorMsg('');
                setAnimationType('success');
                setShowAnimation(true);
                setTimeout(() => setShowAnimation(false), 2500);
            } else {
                setErrorMsg(result.message);
                setAnimationType('error');
                setShowAnimation(true);
                setTimeout(() => setShowAnimation(false), 2500);
            }

        } catch (err) {
            setErrorMsg('Gagal membaca QR dari file gambar ini. Pastikan gambar QR terlihat jelas.');
            setAnimationType('error');
            setShowAnimation(true);
            setTimeout(() => setShowAnimation(false), 2500);
        }
    };

    const handleUpdateData = async (e) => {
        e.preventDefault();
        try {
            if (activeTab === 'kunjungan' || activeTab === 'hadir') {
                const { error } = await supabase
                    .from('kunjungan_tamu')
                    .update({
                        keperluan: editForm.keperluan,
                        menemui: editForm.menemui,
                        status: editForm.status,
                        waktu_hadir: editForm.status === 'Hadir' && editForm.waktu_hadir === '-'
                            ? new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
                            : editForm.waktu_hadir
                    })
                    .eq('id', selectedData.id);

                if (error) throw error;
                alert('Data kunjungan berhasil diperbarui!');
            } else {
                const { error } = await supabase
                    .from('profil_tamu')
                    .update({
                        nama: editForm.nama,
                        instansi: editForm.instansi,
                        whatsapp: editForm.whatsapp,
                        email: editForm.email
                    })
                    .eq('id', selectedData.id);

                if (error) throw error;
                alert('Profil pengguna berhasil diperbarui!');
            }
            setIsEditModalOpen(false);
            refreshAllData();
        } catch (err) {
            alert('Gagal memperbarui data: ' + err.message);
        }
    };

    const handleDeleteData = async (id, identifier) => {
        const targetTable = (activeTab === 'kunjungan' || activeTab === 'hadir') ? 'kunjungan_tamu' : 'profil_tamu';
        const konfirmasi = confirm(`Apakah Anda yakin ingin menghapus data ini (${identifier})?`);
        if (!konfirmasi) return;

        try {
            const { error } = await supabase
                .from(targetTable)
                .delete()
                .eq('id', id);

            if (error) throw error;
            alert('Data berhasil dihapus!');
            refreshAllData();
        } catch (err) {
            alert('Gagal menghapus data: ' + err.message);
        }
    };

    return (
        <main className="min-h-screen bg-slate-900 text-white p-6 relative">
            <div className="mb-8 border-b border-slate-800 pb-4">
                <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
                    SowanQR Admin Dashboard
                </h1>
                <p className="text-slate-400 text-sm mt-1">Sistem Pemantauan & Manajemen Data Tamu Rel-time</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl shadow-xl">
                        <h2 className="text-lg font-bold mb-4 text-indigo-400">Scan QR Code Tamu</h2>
                        <div id="reader" className="overflow-hidden rounded-xl bg-slate-900 border border-slate-700"></div>
                        <div className="mt-4">
                            <label className="block text-xs text-slate-400 mb-2">Atau Upload Gambar QR:</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                    if (e.target.files[0]) handleFileScan(e.target.files[0]);
                                }}
                                className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500"
                            />
                        </div>
                    </div>

                    {scanResult && (
                        <div className={`p-6 rounded-2xl border transition-all ${errorMsg ? 'bg-amber-500/10 border-amber-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
                            <h3 className={`text-md font-bold mb-2 ${errorMsg ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {errorMsg ? 'Informasi Scan' : 'Tamu Berhasil Hadir!'}
                            </h3>
                            <p className="text-sm leading-relaxed text-slate-200 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                                " Nama <span className="text-cyan-400 font-bold">{scanResult.nama}</span> NIK <span className="text-cyan-400 font-bold">{scanResult.nik}</span> dari <span className="text-cyan-400 font-bold">{scanResult.instansi}</span> hadir untuk keperluan <span className="text-cyan-400 font-bold">{scanResult.keperluan}</span> menemui <span className="text-cyan-400 font-bold">{scanResult.menemui}</span> pada pukul <span className="text-emerald-400 font-bold">{scanResult.waktu_hadir}</span> "
                            </p>
                            {errorMsg && <p className="text-xs text-amber-400 mt-2 font-medium">* {errorMsg}</p>}
                        </div>
                    )}
                </div>

                <div className="lg:col-span-8">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl overflow-hidden">

                        {/* ================= BUTTON GRUP NAVIGASI BARU (3 TOMBOL TAB) ================= */}
                        <div className="flex bg-slate-900/60 p-1.5 rounded-xl mb-6 border border-slate-700 max-w-xl">
                            <button onClick={() => setActiveTab('kunjungan')}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'kunjungan' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>
                                🕒 Semua Kunjungan ({historyKunjungan.length})
                            </button>
                            <button onClick={() => setActiveTab('hadir')}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'hadir' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>
                                ✅ Tamu Hadir ({historyKunjungan.filter(k => k.status === 'Hadir').length})
                            </button>
                            <button onClick={() => setActiveTab('profil')}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'profil' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>
                                👤 Profile User ({historyProfil.length})
                            </button>
                        </div>

                        {/* ================= SISTEM PENYARINGAN 3 TABEL SEKALIGUS ================= */}
                        <div className="overflow-x-auto">
                            {activeTab === 'kunjungan' && (
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-700 text-slate-400 text-xs font-semibold">
                                            <th className="py-3 px-4">NIK Pengunjung</th>
                                            <th className="py-3 px-4">Keperluan & Target</th>
                                            <th className="py-3 px-4">Kode Booking</th>
                                            <th className="py-3 px-4">Status & Waktu</th>
                                            <th className="py-3 px-4 text-center">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800 text-xs">
                                        {historyKunjungan.map((kunjungan) => (
                                            <tr key={kunjungan.id} className="hover:bg-slate-700/20 transition-colors">
                                                <td className="py-3.5 px-4">
                                                    <div className="font-bold text-slate-200">{kunjungan.profil_tamu?.nama || 'Tamu'}</div>
                                                    <div className="font-mono text-[10px] text-slate-500">{kunjungan.nik}</div>
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    <div className="text-slate-200 font-medium">{kunjungan.keperluan}</div>
                                                    <div className="text-slate-500 text-[11px]">Menemui: {kunjungan.menemui}</div>
                                                </td>
                                                <td className="py-3.5 px-4 font-mono text-indigo-400 font-semibold">{kunjungan.kode}</td>
                                                <td className="py-3.5 px-4">
                                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold mb-1 ${kunjungan.status === 'Hadir' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/20 text-amber-400 border border-amber-500/20'}`}>
                                                        {kunjungan.status}
                                                    </span>
                                                    <div className="text-slate-400 font-mono text-[11px]">{kunjungan.waktu_hadir}</div>
                                                </td>
                                                <td className="py-3.5 px-4 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button onClick={() => openEditModal(kunjungan)} className="p-1 px-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded text-[11px]">✏️</button>
                                                        <button onClick={() => handleDeleteData(kunjungan.id, kunjungan.kode)} className="p-1 px-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-[11px]">🗑️</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {/* TAB 2: KHUSUS TAMU YANG HADIR SAJA (.filter()) */}
                            {activeTab === 'hadir' && (
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-700 text-slate-400 text-xs font-semibold">
                                            <th className="py-3 px-4">NIK Pengunjung</th>
                                            <th className="py-3 px-4">Keperluan & Target</th>
                                            <th className="py-3 px-4">Kode Booking</th>
                                            <th className="py-3 px-4">Status & Waktu</th>
                                            <th className="py-3 px-4 text-center">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800 text-xs">
                                        {historyKunjungan.filter(k => k.status === 'Hadir').length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="py-12 text-center text-slate-500 font-medium">
                                                    ✨ Belum ada tamu yang check-in/hadir hari ini.
                                                </td>
                                            </tr>
                                        ) : (
                                            historyKunjungan.filter(k => k.status === 'Hadir').map((kunjungan) => (
                                                <tr key={kunjungan.id} className="hover:bg-slate-700/20 transition-colors">
                                                    <td className="py-3.5 px-4">
                                                        <div className="font-bold text-slate-200">{kunjungan.profil_tamu?.nama || 'Tamu'}</div>
                                                        <div className="font-mono text-[10px] text-slate-500">{kunjungan.nik}</div>
                                                    </td>

                                                    <td className="py-3.5 px-4">
                                                        <div className="text-slate-200 font-medium">{kunjungan.keperluan}</div>
                                                        <div className="text-slate-500 text-[11px]">Menemui: {kunjungan.menemui}</div>
                                                    </td>
                                                    <td className="py-3.5 px-4 font-mono text-indigo-400 font-semibold">{kunjungan.kode}</td>
                                                    <td className="py-3.5 px-4">
                                                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold mb-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">
                                                            {kunjungan.status}
                                                        </span>
                                                        <div className="text-slate-400 font-mono text-[11px]">{kunjungan.waktu_hadir}</div>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button onClick={() => openEditModal(kunjungan)} className="p-1 px-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded text-[11px]">✏️</button>
                                                            <button onClick={() => handleDeleteData(kunjungan.id, kunjungan.kode)} className="p-1 px-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-[11px]">🗑️</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            )}

                            {/* TAB 3: PROFIL MASTER USER */}
                            {activeTab === 'profil' && (
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-700 text-slate-400 text-xs font-semibold">
                                            <th className="py-3 px-4">Identitas (NIK)</th>
                                            <th className="py-3 px-4">Nama / Instansi</th>
                                            <th className="py-3 px-4">Kontak WhatsApp</th>
                                            <th className="py-3 px-4">Tanda Tangan</th>
                                            <th className="py-3 px-4 text-center">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800 text-xs">
                                        {historyProfil.map((profil) => (
                                            <tr key={profil.id} className="hover:bg-slate-700/20 transition-colors">
                                                <td className="py-3.5 px-4 font-mono text-slate-400">{profil.nik}</td>
                                                <td className="py-3.5 px-4">
                                                    <div className="font-bold text-slate-200">{profil.nama}</div>
                                                    <div className="text-slate-500 text-[11px]">{profil.instansi}</div>
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    <div className="text-slate-300 font-semibold">{profil.whatsapp}</div>
                                                    <div className="text-slate-500 text-[11px]">{profil.email || '-'}</div>
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    {profil.tanda_tangan ? (
                                                        <a href={profil.tanda_tangan} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline font-medium text-[11px] flex items-center gap-1">👁️ Lihat TTD</a>
                                                    ) : <span className="text-slate-600">-</span>}
                                                </td>
                                                <td className="py-3.5 px-4 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button onClick={() => openEditModal(profil)} className="p-1 px-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded text-[11px]">✏️</button>
                                                        <button onClick={() => handleDeleteData(profil.id, profil.nama)} className="p-1 px-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-[11px]">🗑️</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Edit */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-6 text-slate-200">
                        <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-4">
                            <h3 className="text-md font-bold text-amber-400">
                                ✏️ Edit Data {(activeTab === 'kunjungan' || activeTab === 'hadir') ? 'Kunjungan' : 'Profil Master'}
                            </h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-white text-xl font-bold">&times;</button>
                        </div>

                        <form onSubmit={handleUpdateData} className="space-y-4 text-xs">
                            {(activeTab === 'kunjungan' || activeTab === 'hadir') ? (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-slate-400">NIK (Read Only)</label>
                                        <input type="text" disabled value={editForm.nik} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-500 outline-none" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-slate-400">Keperluan</label>
                                        <input type="text" required value={editForm.keperluan} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none" onChange={e => setEditForm({ ...editForm, keperluan: e.target.value })} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-slate-400">Menemui Siapa</label>
                                        <input type="text" required value={editForm.menemui} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none" onChange={e => setEditForm({ ...editForm, menemui: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-slate-400">Status Kehadiran</label>
                                            <select value={editForm.status} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none" onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                                                <option value="Pending">Pending</option>
                                                <option value="Hadir">Hadir</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-slate-400">Waktu Hadir</label>
                                            <input type="text" value={editForm.waktu_hadir} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none" onChange={e => setEditForm({ ...editForm, waktu_hadir: e.target.value })} />
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-slate-400">Nama Lengkap</label>
                                        <input type="text" required value={editForm.nama} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none" onChange={e => setEditForm({ ...editForm, nama: e.target.value })} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-slate-400">Instansi</label>
                                        <input type="text" required value={editForm.instansi} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none" onChange={e => setEditForm({ ...editForm, instansi: e.target.value })} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-slate-400">WhatsApp</label>
                                        <input type="text" required value={editForm.whatsapp} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none" onChange={e => setEditForm({ ...editForm, whatsapp: e.target.value })} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-slate-400">Email</label>
                                        <input type="email" value={editForm.email} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none" onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
                                    </div>
                                </>
                            )}

                            <div className="flex justify-end gap-2 pt-4 border-t border-slate-700">
                                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold text-white">Batal</button>
                                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold text-white shadow-md">Simpan</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* OVERLAY POP-UP NOTIFIKASI ANIMASI BERHASIL / GAGAL */}
            {showAnimation && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm transition-all duration-300">
                    <div className={`p-8 rounded-3xl bg-slate-900 border text-center shadow-2xl max-w-xs w-full mx-4 transform scale-100 transition-all duration-300 animate-in fade-in zoom-in-95 ${animationType === 'success' ? 'border-emerald-500/30 shadow-emerald-500/10' : 'border-rose-500/30 shadow-rose-500/10'
                        }`}>
                        <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-5 text-4xl font-extrabold animate-bounce ${animationType === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                            }`}>
                            {animationType === 'success' ? '✓' : '✕'}
                        </div>
                        <h3 className={`text-xl font-black tracking-wide ${animationType === 'success' ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                            {animationType === 'success' ? 'SCAN BERHASIL!' : 'SCAN GAGAL!'}
                        </h3>
                        <p className="text-xs text-slate-400 mt-2 font-medium leading-relaxed">
                            {animationType === 'success'
                                ? 'Kehadiran tamu telah berhasil tercatat otomatis ke dalam sistem.'
                                : errorMsg || 'Terjadi kesalahan, kode QR tidak dikenali.'
                            }
                        </p>
                    </div>
                </div>
            )}
        </main>
    );
}