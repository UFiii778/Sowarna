'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import QRCode from 'qrcode';

export default function Dashboard() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('beranda');
    const [user, setUser] = useState(null);
    const [history, setHistory] = useState([]);
    const [greeting, setGreeting] = useState('');
    const [loading, setLoading] = useState(true);

    const [editForm, setEditForm] = useState({});
    const [bookingForm, setBookingForm] = useState({ keperluan: '', menemui: '' });
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [selectedQr, setSelectedQr] = useState({ qr_url: '', kode: '', keperluan: '' });

    const downloadQR = (qrDataUrl, kodeBooking) => {
        const link = document.createElement('a');
        link.href = qrDataUrl;
        link.download = `SowanQR-${kodeBooking}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 11) setGreeting('Selamat Pagi');
        else if (hour < 15) setGreeting('Selamat Siang');
        else if (hour < 18) setGreeting('Selamat Sore');
        else setGreeting('Selamat Malam');

        const nikSession = localStorage.getItem('user_nik');
        if (!nikSession) {
            router.push('/');
            return;
        }

        fetchDashboardData(nikSession);

        const channelUserKunjungan = supabase
            .channel('realtime-user-kunjungan')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'kunjungan_tamu',
                    filter: `nik=eq.${nikSession}`
                },
                async (payload) => {
                    console.log('🔔 Status Kunjungan Berubah:', payload.new);

                    const qrBase64 = await QRCode.toDataURL(payload.new.kode);
                    const updatedItem = {
                        ...payload.new,
                        qr_url: qrBase64
                    };

                    setHistory((prevHistory) =>
                        prevHistory.map((item) => item.id === payload.new.id ? updatedItem : item)
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channelUserKunjungan);
        };
    }, [router]);

    const fetchDashboardData = async (nik) => {
        setLoading(true);
        try {
            const { data: profil } = await supabase.from('profil_tamu').select('*').eq('nik', nik).single();
            if (profil) {
                setUser(profil);
                setEditForm(profil);
            }

            const { data: riwayat } = await supabase
                .from('kunjungan_tamu')
                .select('*')
                .eq('nik', nik)
                .order('created_at', { ascending: false });

            if (riwayat) {
                const riwayatWithQR = await Promise.all(riwayat.map(async (item) => {
                    const qrBase64 = await QRCode.toDataURL(item.kode);
                    return {
                        ...item,
                        qr_url: qrBase64
                    };
                }));
                setHistory(riwayatWithQR);
            }
        } catch (error) {
            console.error("Gagal memuat data dashboard:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        const { error } = await supabase.from('profil_tamu').update({
            nama: editForm.nama,
            whatsapp: editForm.whatsapp,
            email: editForm.email
        }).eq('nik', user.nik);

        if (!error) {
            alert("Profil berhasil diperbarui!");
            fetchDashboardData(user.nik);
        } else {
            alert("Gagal memperbarui profil.");
        }
    };

    const handleNewBooking = async (e) => {
        e.preventDefault();
        const kodeBooking = `SQ-${Date.now()}`;

        try {
            const qrBase64 = await QRCode.toDataURL(kodeBooking);

            const { error: insertError } = await supabase.from('kunjungan_tamu').insert([{
                nik: user.nik,
                keperluan: bookingForm.keperluan,
                menemui: bookingForm.menemui,
                kode: kodeBooking,
                status: 'Pending',
                waktu_hadir: '-'
            }]);

            if (insertError) {
                throw new Error(insertError.message);
            }

            const dataKunjunganBaru = {
                nik: user.nik,
                nama: user.nama,
                instansi: user.instansi || '-',
                whatsapp: user.whatsapp,
                keperluan: bookingForm.keperluan,
                menemui: bookingForm.menemui,
                kode: kodeBooking,
                status: 'Pending',
                waktu_hadir: '-',
                created_at: new Date().toLocaleString('id-ID')
            };

            fetch('/api/booking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataKunjunganBaru)
            }).catch(err => console.error("Gagal mengirim antrean latar belakang:", err));

            setHistory((prevHistory) => [{ ...dataKunjunganBaru, created_at: new Date().toISOString(), qr_url: qrBase64 }, ...prevHistory]);
            setBookingForm({ keperluan: '', menemui: '' });
            setActiveTab('riwayat');

        } catch (error) {
            console.error("Gagal membuat booking baru:", error);
            alert(`Gagal membuat booking! Pesan Error: ${error.message}`);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('user_nik');
        router.push('/');
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat Dashboard...</div>;

    return (
        <div className="flex min-h-screen bg-slate-50">

            {/* SIDEBAR */}
            <aside className="w-64 bg-white shadow-xl hidden md:flex flex-col border-r border-slate-200">
                <div className="p-6 border-b border-slate-100">
                    <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">SowanQR</h1>
                    <p className="text-xs text-slate-500 mt-1">Dashboard Tamu</p>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    <button onClick={() => setActiveTab('beranda')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'beranda' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                        🏠 Beranda
                    </button>
                    <button onClick={() => setActiveTab('riwayat')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'riwayat' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                        📅 Riwayat & Booking
                    </button>
                    <button onClick={() => setActiveTab('pengaturan')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'pengaturan' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                        ⚙️ Pengaturan Akun
                    </button>
                </nav>
                <div className="p-4 border-t border-slate-100">
                    <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-3 text-rose-600 font-bold hover:bg-rose-50 rounded-xl transition-all">
                        🚪 Keluar
                    </button>
                </div>
            </aside>

            {/* KONTEN UTAMA */}
            <main className="flex-1 p-6 sm:p-10 overflow-y-auto">
                <header className="mb-8">
                    <h2 className="text-3xl font-bold text-slate-800">
                        {greeting}, <span className="text-indigo-600">{user?.nama?.split(' ')[0]}!</span> 👋
                    </h2>
                    <p className="text-slate-500">Selamat datang di panel kontrol tamu Anda.</p>
                </header>

                {/* TAB BERANDA */}
                {activeTab === 'beranda' && (
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <h3 className="text-xl font-bold text-slate-800 mb-4">Pengumuman Terbaru</h3>
                            <div className="space-y-4">
                                <article className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
                                    <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-1 rounded-md">Info Pendidikan</span>
                                    <h4 className="font-bold text-slate-800 mt-2">Kebijakan Baru Kunjungan Sekolah</h4>
                                    <p className="text-sm text-slate-600 mt-1">Mulai bulan depan, seluruh tamu diwajibkan menunjukkan QR Code aktif yang berwarna Hijau (Sudah Di-scan) sebelum memasuki area tata usaha. Hal ini bertujuan untuk meningkatkan keamanan instansi.</p>
                                </article>
                                <article className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
                                    <span className="text-xs font-bold text-green-700 bg-indigo-100 px-2 py-1 rounded-md">Info Tugas</span>
                                    <h4 className="font-bold text-slate-800 mt-2">PJBL (Project-Based Learning) atau Pembelajaran Berbasis Proyek</h4>
                                    <p className="text-sm text-slate-600 mt-1">PjBL (Project-Based Learning) atau Pembelajaran Berbasis Proyek adalah metode pembelajaran di mana siswa atau mahasiswa belajar secara aktif dengan memecahkan masalah dunia nyata melalui pengerjaan proyek yang kompleks. Metode ini berfokus pada pengalaman langsung, investigasi mendalam, dan kreativitas hingga menghasilkan sebuah produk</p>
                                </article>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB RIWAYAT & BOOKING */}
                {activeTab === 'riwayat' && (
                    <div className="grid lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-fit">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">✨ Buat Kunjungan Baru</h3>
                            <form onSubmit={handleNewBooking} className="space-y-4">
                                <div>
                                    <label className="text-sm font-semibold text-slate-700">Keperluan</label>
                                    <input type="text" required value={bookingForm.keperluan} onChange={(e) => setBookingForm({ ...bookingForm, keperluan: e.target.value })} className="w-full mt-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="Rapat, dinas, dll" />
                                </div>
                                <div>
                                    <label className="text-sm font-semibold text-slate-700">Menemui</label>
                                    <input type="text" required value={bookingForm.menemui} onChange={(e) => setBookingForm({ ...bookingForm, menemui: e.target.value })} className="w-full mt-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="Nama orang" />
                                </div>
                                <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-lg hover:bg-indigo-700 transition">Buat QR Baru</button>
                            </form>
                        </div>

                        {/* List Riwayat */}
                        <div className="lg:col-span-2 space-y-4">
                            <h3 className="text-lg font-bold text-slate-800">Riwayat Kunjungan Anda</h3>
                            {history.length === 0 ? (
                                <p className="text-slate-500">Belum ada riwayat kunjungan.</p>
                            ) : (
                                history.map((item, idx) => (
                                    <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
                                        <div className="flex flex-col items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <img src={item.qr_url} alt="QR Code" className="w-24 h-24 rounded-lg border border-slate-200 bg-white" />
                                            <button
                                                type="button"
                                                onClick={() => downloadQR(item.qr_url, item.kode)}
                                                className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md hover:bg-indigo-100 transition-all flex items-center gap-1"
                                            >
                                                ⬇️ Download
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedQr({ qr_url: item.qr_url, kode: item.kode, keperluan: item.keperluan });
                                                    setIsQrModalOpen(true);
                                                }}
                                                className="text-[11px] font-bold text-white bg-indigo-600 px-2 py-1.5 rounded-md hover:bg-indigo-700 transition-all flex items-center gap-1 flex-1 justify-center"
                                            >
                                                📱 Scan
                                            </button>
                                        </div>

                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-mono text-xs font-bold text-slate-500">{item.kode}</span>
                                                {item.status.toLowerCase() === 'scanned' || item.status.toLowerCase() === 'hadir' ? (
                                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">✅ QR Sudah Di-scan</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">⏳ Menunggu Scan</span>
                                                )}
                                            </div>
                                            <h4 className="font-bold text-slate-800 text-lg">{item.keperluan}</h4>
                                            <p className="text-sm text-slate-600">Menemui: <span className="font-semibold">{item.menemui}</span></p>
                                            <p className="text-xs text-slate-400 mt-2">Dibuat pada: {new Date(item.created_at).toLocaleDateString('id-ID')}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* TAB PENGATURAN */}
                {activeTab === 'pengaturan' && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 max-w-2xl">
                        <h3 className="text-xl font-bold text-slate-800 mb-6">Pengaturan Profil</h3>
                        <form onSubmit={handleUpdateProfile} className="space-y-4">
                            <div>
                                <label className="text-sm font-semibold text-slate-700">NIK (Tidak dapat diubah)</label>
                                <input type="text" disabled value={editForm.nik || ''} className="w-full mt-1 px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed" />
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-slate-700">Nama Lengkap</label>
                                <input type="text" value={editForm.nama || ''} onChange={e => setEditForm({ ...editForm, nama: e.target.value })} className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-slate-700">WhatsApp</label>
                                <input type="text" value={editForm.whatsapp || ''} onChange={e => setEditForm({ ...editForm, whatsapp: e.target.value })} className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-slate-700">Email</label>
                                <input type="email" value={editForm.email || ''} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <button type="submit" className="mt-4 bg-indigo-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-indigo-700 transition">Simpan Perubahan</button>
                        </form>
                    </div>
                )}
            </main>

            <nav className="md:hidden fixed bottom-0 w-full bg-white border-t flex justify-around p-3 z-50 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
                <button onClick={() => setActiveTab('beranda')} className={`text-2xl ${activeTab === 'beranda' ? 'text-indigo-600' : 'text-slate-400'}`}>🏠</button>
                <button onClick={() => setActiveTab('riwayat')} className={`text-2xl ${activeTab === 'riwayat' ? 'text-indigo-600' : 'text-slate-400'}`}>📅</button>
                <button onClick={() => setActiveTab('pengaturan')} className={`text-2xl ${activeTab === 'pengaturan' ? 'text-indigo-600' : 'text-slate-400'}`}>⚙️</button>
            </nav>

            {isQrModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md transition-all">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl border border-slate-100 transform scale-100 animate-in fade-in zoom-in-95 duration-200">

                        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                            <div className="text-left">
                                <h4 className="font-extrabold text-slate-800 text-base">Tunjukkan QR Code</h4>
                                <p className="text-xs text-slate-400 font-medium">Arahkan ke kamera scanner petugas</p>
                            </div>
                            <button
                                onClick={() => setIsQrModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 font-bold flex items-center justify-center text-lg transition-all"
                            >
                                &times;
                            </button>
                        </div>

                        {/* Kontainer Gambar QR Ukuran Besar */}
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/60 shadow-inner flex flex-col items-center justify-center my-4">
                            <img
                                src={selectedQr.qr_url}
                                alt="QR Code Perbesar"
                                className="w-56 h-56 rounded-xl border border-slate-200 bg-white p-2 shadow-sm"
                            />
                        </div>

                        <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100/50 mb-4 text-left">
                            <div className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-500">Keperluan</div>
                            <div className="text-sm font-bold text-slate-800 truncate">{selectedQr.keperluan}</div>

                            <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mt-2">Kode Token</div>
                            <div className="text-xs font-mono font-bold text-slate-600 tracking-widest">{selectedQr.kode}</div>
                        </div>

                        <button
                            onClick={() => setIsQrModalOpen(false)}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition shadow-md shadow-indigo-600/10 text-sm"
                        >
                            Selesai & Tutup
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}