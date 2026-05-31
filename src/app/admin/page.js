'use client';
import { useState, useEffect } from 'react';
import { ScanQrCode, History, Users2Icon } from 'lucide-react';
import Swal from 'sweetalert2';
import { supabase } from '@/lib/supabase';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';

export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState('scan');

    const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
    const [adminPassword, setAdminPassword] = useState('');

    const [historyKunjungan, setHistoryKunjungan] = useState([]);
    const [historyProfil, setHistoryProfil] = useState([]);
    const [scanResult, setScanResult] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');

    const ToastAdmin = Swal.mixin({
        background: '#1e293b', // bg-slate-800
        color: '#f8fafc',      // text-slate-50
        confirmButtonColor: '#4f46e5', // bg-indigo-600
        cancelButtonColor: '#334155',  // bg-slate-700
        customClass: {
            popup: 'rounded-2xl border border-slate-700 shadow-xl',
            title: 'font-black tracking-wide text-lg',
            htmlContainer: 'text-xs text-slate-400 font-medium',
            confirmButton: 'px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider',
            cancelButton: 'px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider'
        }
    });

    const [showAnimation, setShowAnimation] = useState(false);
    const [animationType, setAnimationType] = useState('success');
    const [isScanning, setIsScanning] = useState(false);
    const [scannerInstance, setScannerInstance] = useState(null);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedData, setSelectedData] = useState(null);
    const [editForm, setEditForm] = useState({});

    // Fetch data kunjungan dari Supabase
    const fetchKunjungan = async () => {
        const { data, error } = await supabase
            .from('kunjungan_tamu')
            .select(`
                *,
                profil_tamu (
                    nama,
                    instansi,
                    whatsapp
                )
            `)
            .order('id', { ascending: false });

        if (error) {
            console.error("Gagal mengambil data kunjungan:", error.message);
        } else if (data) {
            const formattedData = data.map(item => ({
                ...item,
                nama: item.profil_tamu?.nama || '-',
                instansi: item.profil_tamu?.instansi || '-',
                whatsapp: item.profil_tamu?.whatsapp || '-'
            }));
            setHistoryKunjungan(formattedData);
        }
    };

    // Fetch data profil master dari Supabase
    const fetchProfil = async () => {
        const { data, error } = await supabase
            .from('profil_tamu')
            .select('*')
            .order('id', { ascending: false });

        if (error) {
            console.error("Gagal mengambil data profil:", error.message);
        } else if (data) {
            setHistoryProfil(data);
        }
    };

    const refreshAllData = () => {
        fetchKunjungan();
        fetchProfil();
    };

    useEffect(() => {
        if (isAdminAuthenticated) {
            refreshAllData();
        }
    }, [isAdminAuthenticated]);

    const handleScanSuccess = async (decodedText) => {
        try {
            const response = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kodeBooking: decodedText.trim() })
            });

            const resData = await response.json();

            if (resData.success) {
                const audio = new Audio('/beep-06.wav');
                audio.volume = 0.6;
                audio.play().catch(err => console.log("Autoplay diblokir browser:", err));

                setScanResult(resData.data);
                setAnimationType('success');
                setShowAnimation(true);
                refreshAllData();
            } else {
                const audio = new Audio('/gagal.wav');
                audio.volume = 0.6;
                audio.play().catch(err => console.log("Autoplay diblokir browser:", err));

                setErrorMsg(resData.message);
                setAnimationType('error');
                setShowAnimation(true);
            }
        } catch (err) {
            setErrorMsg('Gagal menghubungi server');
            setAnimationType('error');
            setShowAnimation(true);
        }
    };

    // Scan via Kamera
    const startScanner = () => {
        setIsScanning(true);
        setTimeout(() => {
            const html5QrcodeScanner = new Html5QrcodeScanner(
                "reader",
                { fps: 10, qrbox: { width: 250, height: 250 } },
                false
            );
            html5QrcodeScanner.render(
                (text) => {
                    html5QrcodeScanner.clear();
                    setIsScanning(false);
                    handleScanSuccess(text);
                },
                (err) => { }
            );
            setScannerInstance(html5QrcodeScanner);
        }, 300);
    };

    const stopScanner = () => {
        if (scannerInstance) {
            scannerInstance.clear();
            setIsScanning(false);
        }
    };

    // Scan via File Gambar Luar
    const handleFileScan = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const html5QrCode = new Html5Qrcode("file-scan-tracker");
        try {
            const decodedText = await html5QrCode.scanFile(file, true);
            await handleScanSuccess(decodedText);
        } catch (err) {
            setErrorMsg('QR Code tidak terdeteksi pada file tersebut. Pastikan kualitas gambar jelas.');
            setAnimationType('error');
            setShowAnimation(true);
        }
    };

    const handleAdminLogin = (e) => {
        e.preventDefault();
        if (adminPassword === '24651458') {
            setIsAdminAuthenticated(true);
            setErrorMsg('');
        } else {
            alert('Password Admin Salah!');
        }
    };

    const openEditModal = (item, table) => {
        setSelectedData({ ...item, table });
        setEditForm(item);
        setIsEditModalOpen(true);
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('/api/admin', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer 24651458'
                },
                body: JSON.stringify({
                    targetTable: selectedData.table,
                    id: selectedData.id,
                    updateData: editForm
                })
            });

            const res = await response.json();
            if (res.success) {
                // ✨ GANTI TAMPILAN ALERT EDIT BERHASIL
                ToastAdmin.fire({
                    title: 'Berhasil!',
                    text: 'Perubahan data berhasil disimpan.',
                    icon: 'success',
                    iconColor: '#10b981'
                });
                setIsEditModalOpen(false);
                refreshAllData();
            } else {
                ToastAdmin.fire({
                    title: 'Gagal Update',
                    text: res.message,
                    icon: 'error'
                });
            }
        } catch (err) {
            ToastAdmin.fire({
                title: 'Error',
                text: 'Terjadi kesalahan jaringan.',
                icon: 'error'
            });
        }
    };

    const handleDelete = async (id, table) => {
        ToastAdmin.fire({
            title: 'Hapus Data?',
            text: "Apakah Anda yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan.",
            icon: 'warning',
            iconColor: '#f43f5e', // Warna rose-500
            showCancelButton: true,
            confirmButtonText: 'Ya, Hapus!',
            cancelButtonText: 'Batal',
            reverseButtons: true
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const response = await fetch(`/api/admin?table=${table}&id=${id}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': 'Bearer 24651458'
                        }
                    });

                    const res = await response.json();
                    if (res.success) {
                        ToastAdmin.fire({
                            title: 'Terhapus!',
                            text: 'Data berhasil dihapus dari database.',
                            icon: 'success',
                            iconColor: '#10b981'
                        });
                        refreshAllData();
                    } else {
                        ToastAdmin.fire({
                            title: 'Gagal Menghapus',
                            text: res.message,
                            icon: 'error'
                        });
                    }
                } catch (err) {
                    ToastAdmin.fire({
                        title: 'Kesalahan Jaringan',
                        text: 'Terjadi masalah saat menghubungi server.',
                        icon: 'error'
                    });
                }
            }
        });
    };

    if (!isAdminAuthenticated) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-xl">
                    <h2 className="text-2xl font-black text-white mb-2 tracking-wide">Panel Petugas SowanQR</h2>
                    <p className="text-slate-400 text-sm mb-6">Masukkan kata sandi khusus petugas untuk masuk ke panel kontrol.</p>
                    <form onSubmit={handleAdminLogin} className="space-y-4">
                        <input
                            type="password"
                            required
                            placeholder="Masukkan Password Admin"
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-all text-sm"
                        />
                        <button
                            type="submit"
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-600/20 transition-all text-sm"
                        >
                            Buka Dashboard
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
            <div id="file-scan-tracker" className="hidden"></div>

            <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 sticky top-0 z-40 shadow-sm">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-xl font-black shadow-lg shadow-indigo-600/30">S</div>
                        <div>
                            <h1 className="text-lg font-black tracking-wide">SowanQR Control Center</h1>
                            <p className="text-xs text-indigo-400 font-semibold tracking-wider uppercase">Panel Manajemen Kehadiran Tamu</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button onClick={refreshAllData} className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all border border-slate-700">
                            Refresh Database
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">

                <div className="flex border-b border-slate-800 bg-slate-900/40 p-1 rounded-xl border">
                    <button
                        onClick={() => { stopScanner(); setActiveTab('scan'); }}
                        className={`flex-1 sm:flex-none px-6 py-3 text-xs font-black tracking-wider uppercase border-b-2 rounded-lg transition-all ${activeTab === 'scan' ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                    >
                        <ScanQrCode className="w-6 h-6" /> Scan QR Code
                    </button>
                    <button
                        onClick={() => { stopScanner(); setActiveTab('kunjungan'); }}
                        className={`flex-1 sm:flex-none px-6 py-3 text-xs font-black tracking-wider uppercase border-b-2 rounded-lg transition-all ${activeTab === 'kunjungan' ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                    >
                        <History className="w-5 h-5" /> Riwayat Kunjungan
                    </button>
                    <button
                        onClick={() => { stopScanner(); setActiveTab('profil'); }}
                        className={`flex-1 sm:flex-none px-6 py-3 text-xs font-black tracking-wider uppercase border-b-2 rounded-lg transition-all ${activeTab === 'profil' ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                    >
                        <Users2Icon className="w-5 h-5" /> Database Profil
                    </button>
                </div>

                {activeTab === 'scan' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Kiri: Scanner Kamera */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[350px]">
                            <div>
                                <h3 className="text-md font-bold text-white mb-1">Metode 1: Scan Lewat Kamera</h3>
                                <p className="text-xs text-slate-400 mb-4">Gunakan kamera perangkat secara realtime untuk memvalidasi tiket masuk qr.</p>
                            </div>

                            <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 rounded-xl p-4 border border-slate-850 relative overflow-hidden">
                                {isScanning ? (
                                    <div id="reader" className="w-full max-w-[300px] overflow-hidden rounded-lg"></div>
                                ) : (
                                    <div className="text-center py-8">
                                        <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-500 text-xl mb-3">📹</div>
                                        <p className="text-xs text-slate-500 font-medium">Kamera dalam keadaan nonaktif</p>
                                    </div>
                                )}
                            </div>

                            <div className="mt-4">
                                {isScanning ? (
                                    <button onClick={stopScanner} className="w-full py-2.5 bg-rose-950/40 border border-rose-500/30 text-rose-400 text-xs font-bold rounded-xl hover:bg-rose-900/50 transition-all">
                                        Matikan Kamera
                                    </button>
                                ) : (
                                    <button onClick={startScanner} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/10 transition-all">
                                        Aktifkan Scanner Kamera
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Kanan: Unggah File Gambar */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[350px]">
                            <div>
                                <h3 className="text-md font-bold text-white mb-1">Metode 2: Upload File QR Code</h3>
                                <p className="text-xs text-slate-400 mb-4">Gunakan metode ini jika pengunjung mengirimkan foto/screenshot QR melalui WhatsApp.</p>
                            </div>

                            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-xl bg-slate-950/50 p-6 text-center hover:border-indigo-500/50 transition-all relative">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileScan}
                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                />
                                <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 text-xl mb-3">📁</div>
                                <span className="text-xs font-bold text-slate-300 block mb-1">Pilih atau Drag File Gambar Disini</span>
                                <span className="text-[11px] text-slate-500">Mendukung format PNG, JPG, JPEG, atau WebP</span>
                            </div>

                            <div className="mt-4">
                                <div className="text-center text-[11px] text-indigo-400 font-semibold bg-indigo-500/5 py-2.5 rounded-xl border border-indigo-500/10">
                                    Sistem akan langsung otomatis membaca tiket setelah file dipilih
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* MENU 2: RIWAYAT KUNJUNGAN */}
                {activeTab === 'kunjungan' && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-850/50 border-b border-slate-800 text-xs font-bold tracking-wider text-slate-400 uppercase">
                                        <th className="px-6 py-4">Kode Booking</th>
                                        <th className="px-6 py-4">Nama Tamu</th>
                                        <th className="px-6 py-4">Instansi</th>
                                        <th className="px-6 py-4">Menemui</th>
                                        <th className="px-6 py-4">Keperluan</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Waktu Hadir</th>
                                        <th className="px-6 py-4 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {historyKunjungan.length === 0 ? (
                                        <tr><td colSpan="8" className="px-6 py-12 text-center text-sm text-slate-500 font-medium">Belum ada riwayat data kunjungan.</td></tr>
                                    ) : (
                                        historyKunjungan.map((item) => (
                                            <tr key={item.id} className="hover:bg-slate-850/30 transition-all">
                                                <td className="px-6 py-4 text-sm font-bold text-indigo-400 tracking-wide">{item.kode}</td>
                                                <td className="px-6 py-4 text-sm font-medium text-white">{item.nama}</td>
                                                <td className="px-6 py-4 text-sm text-slate-300">{item.instansi}</td>
                                                <td className="px-6 py-4 text-sm text-slate-300 font-medium">{item.menemui}</td>
                                                <td className="px-6 py-4 text-sm text-slate-400">{item.keperluan}</td>
                                                <td className="px-6 py-4 text-sm">
                                                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wide uppercase ${item.status === 'Hadir' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                                                        {item.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-400 font-medium">{item.waktu_hadir || '-'}</td>
                                                <td className="px-6 py-4 text-sm text-center space-x-2 whitespace-nowrap">
                                                    <button onClick={() => openEditModal(item, 'kunjungan_tamu')} className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-indigo-400 font-bold transition-all">Edit</button>
                                                    <button onClick={() => handleDelete(item.id, 'kunjungan_tamu')} className="text-xs bg-slate-800 hover:bg-rose-950/40 px-3 py-1.5 rounded-lg text-rose-400 font-bold transition-all">Hapus</button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* MENU 3: DATABASE MASTER PROFIL */}
                {activeTab === 'profil' && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-850/50 border-b border-slate-800 text-xs font-bold tracking-wider text-slate-400 uppercase">
                                        <th className="px-6 py-4">NIK</th>
                                        <th className="px-6 py-4">Nama Lengkap</th>
                                        <th className="px-6 py-4">Instansi</th>
                                        <th className="px-6 py-4">WhatsApp</th>
                                        <th className="px-6 py-4 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {historyProfil.length === 0 ? (
                                        <tr><td colSpan="5" className="px-6 py-12 text-center text-sm text-slate-500 font-medium">Belum ada profil terdaftar.</td></tr>
                                    ) : (
                                        historyProfil.map((item) => (
                                            <tr key={item.id} className="hover:bg-slate-850/30 transition-all">
                                                <td className="px-6 py-4 text-sm text-slate-400 font-mono tracking-wide">{item.nik}</td>
                                                <td className="px-6 py-4 text-sm font-bold text-white">{item.nama}</td>
                                                <td className="px-6 py-4 text-sm text-slate-300">{item.instansi}</td>
                                                <td className="px-6 py-4 text-sm text-slate-300 font-medium">{item.whatsapp}</td>
                                                <td className="px-6 py-4 text-sm text-center space-x-2 whitespace-nowrap">
                                                    <button onClick={() => openEditModal(item, 'profil_tamu')} className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-indigo-400 font-bold transition-all">Edit</button>
                                                    <button onClick={() => handleDelete(item.id, 'profil_tamu')} className="text-xs bg-slate-800 hover:bg-rose-950/40 px-3 py-1.5 rounded-lg text-rose-400 font-bold transition-all">Hapus</button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>

            {/* 🎥 MODAL ANIMASI SCAN BERHASIL / GAGAL */}
            {showAnimation && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className={`p-6 rounded-3xl bg-slate-900 border text-center shadow-2xl max-w-xs w-full mx-4 transform scale-100 transition-all duration-300 ${animationType === 'success' ? 'border-emerald-500/30 shadow-emerald-500/10' : 'border-rose-500/30 shadow-rose-500/10'}`}>
                        <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-5 text-4xl font-extrabold ${animationType === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                            {animationType === 'success' ? '✓' : '✕'}
                        </div>
                        <h3 className={`text-xl font-black tracking-wide ${animationType === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {animationType === 'success' ? 'SCAN BERHASIL!' : 'SCAN GAGAL!'}
                        </h3>
                        <p className="text-xs text-slate-400 mt-2 font-medium leading-relaxed">
                            {animationType === 'success' ? 'Kehadiran tamu telah berhasil tercatat otomatis ke dalam sistem.' : errorMsg || 'Terjadi kesalahan, kode QR tidak dikenali.'}
                        </p>
                        {animationType === 'success' && scanResult && (
                            <div className="mt-4 p-3 bg-slate-950 rounded-xl border border-slate-800 text-left space-y-1.5">
                                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Detail Kedatangan:</p>
                                <p className="text-xs text-white font-black"><span className="text-slate-400 font-normal">Nama:</span> {scanResult.nama}</p>
                                <p className="text-xs text-slate-300 font-medium"><span className="text-slate-400 font-normal">Tujuan:</span> {scanResult.menemui}</p>
                                <p className="text-[11px] text-indigo-400 font-mono text-right mt-1">{scanResult.waktu_hadir}</p>
                            </div>
                        )}
                        <button onClick={() => setShowAnimation(false)} className={`mt-5 w-full py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all shadow-md ${animationType === 'success' ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/10' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}`}>
                            Selesai & Tutup
                        </button>
                    </div>
                </div>
            )}

            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
                        <h3 className="text-lg font-black text-white tracking-wide">Edit Data ({selectedData?.table === 'kunjungan_tamu' ? 'Kunjungan' : 'Profil'})</h3>
                        <form onSubmit={handleEditSubmit} className="space-y-4">
                            {selectedData?.table === 'kunjungan_tamu' ? (
                                <>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 block mb-1">Nama Orang Yang Ingin Menemui</label>
                                        <input type="text" value={editForm.menemui || ''} onChange={(e) => setEditForm({ ...editForm, menemui: e.target.value })} className="w-full p-2.5 text-sm bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 block mb-1">Keperluan</label>
                                        <textarea value={editForm.keperluan || ''} onChange={(e) => setEditForm({ ...editForm, keperluan: e.target.value })} className="w-full p-2.5 text-sm bg-slate-800 border border-slate-700 rounded-xl text-white h-20 focus:outline-none focus:border-indigo-500"></textarea>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 block mb-1">Status Kehadiran</label>
                                        <select value={editForm.status || 'Pending'} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="w-full p-2.5 text-sm bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500">
                                            <option value="Pending">Pending</option>
                                            <option value="Hadir">Hadir</option>
                                        </select>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 block mb-1">Nama Lengkap Tamu</label>
                                        <input type="text" value={editForm.nama || ''} onChange={(e) => setEditForm({ ...editForm, nama: e.target.value })} className="w-full p-2.5 text-sm bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 block mb-1">Instansi / Perusahaan</label>
                                        <input type="text" value={editForm.instansi || ''} onChange={(e) => setEditForm({ ...editForm, instansi: e.target.value })} className="w-full p-2.5 text-sm bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 block mb-1">No WhatsApp</label>
                                        <input type="text" value={editForm.whatsapp || ''} onChange={(e) => setEditForm({ ...editForm, whatsapp: e.target.value })} className="w-full p-2.5 text-sm bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500" />
                                    </div>
                                </>
                            )}
                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl">Batal</button>
                                <button type="submit" className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">Simpan Perubahan</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}