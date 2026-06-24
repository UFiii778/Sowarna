'use client';
import { useState, useEffect } from 'react';
import { ClipboardList, Users2, Settings, ExternalLinkIcon, HomeIcon, SunIcon, MoonIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { dictionary } from '@/constants/languages';
import QRCode from 'qrcode';
import Swal from 'sweetalert2';


import Aurora from '@/components/Aurora';

export default function Dashboard() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('beranda');
    const [user, setUser] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [greeting, setGreeting] = useState('');
    const [lang, setLang] = useState('id'); // Default Bahasa Indonesia
    const [isDarkMode, setIsDarkMode] = useState(false);

    const ToastUser = Swal.mixin({
        background: isDarkMode ? '#0F1C2A' : '#ffffff',
        color: isDarkMode ? '#f8fafc' : '#0f172a',
        confirmButtonColor: '#46A0E5',
        customClass: {
            popup: 'rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl',
            title: 'font-black tracking-wide text-lg',
            htmlContainer: 'text-xs font-medium',
            confirmButton: 'px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider active:scale-95 transition-all'
        }
    });

    const [editForm, setEditForm] = useState({});
    const [bookingForm, setBookingForm] = useState({ keperluan: '', menemui: '' });
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [selectedQr, setSelectedQr] = useState({ qr_url: '', kode: '', keperluan: '' });

    const t = dictionary[lang] || dictionary['id'];

    const downloadQR = (qrDataUrl, kodeBooking) => {
        const link = document.createElement('a');
        link.href = qrDataUrl;
        link.download = `SowanQR-${kodeBooking}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const toggleDarkMode = () => {
        if (isDarkMode) {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
            setIsDarkMode(false);
        } else {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            setIsDarkMode(true);
        }
    };

    const toggleLanguage = () => {
        const nextLang = lang === 'id' ? 'en' : 'id';
        setLang(nextLang);
        localStorage.setItem('user_lang', nextLang);
    };

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            setIsDarkMode(true);
            document.documentElement.classList.add('dark');
        } else {
            setIsDarkMode(false);
            document.documentElement.classList.remove('dark');
        }
        const savedLang = localStorage.getItem('user_lang') || 'id';
        setLang(savedLang);

        const currentTranslation = dictionary[savedLang] || dictionary['id'];

        const hour = new Date().getHours();
        if (hour < 11) {
            setGreeting(currentTranslation.morning);
        } else if (hour < 15) {
            setGreeting(currentTranslation.day);
        } else if (hour < 18) {
            setGreeting(currentTranslation.afternoon);
        } else {
            setGreeting(currentTranslation.night);
        }

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
                },
                async (payload) => {
                    console.log('Status Kunjungan Berubah:', payload.new);
                    const nikSession = localStorage.getItem('user_nik');

                    if (payload.new.nik === nikSession) {
                        const qrBase64 = await QRCode.toDataURL(payload.new.kode);
                        const updatedItem = {
                            ...payload.new,
                            qr_url: qrBase64
                        };

                        setHistory((prevHistory) =>
                            prevHistory.map((item) => item.kode === payload.new.kode ? updatedItem : item)
                        );
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channelUserKunjungan);
        };
    }, [router, lang]);

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
                const riwayatWithQR = await Promise.all(riwayat.map(async (item, idx) => {
                    const textUntukQR = item.kode && item.kode.trim() !== '' ? item.kode : `SQ-UNKNOWN-${item.id_kunjungan || idx}`;
                    try {
                        const qrBase64 = await QRCode.toDataURL(textUntukQR);
                        return {
                            ...item,
                            kode: textUntukQR,
                            qr_url: qrBase64
                        };
                    } catch (qrErr) {
                        console.error("Gagal generate single QR:", qrErr);
                        return {
                            ...item,
                            kode: textUntukQR,
                            qr_url: ''
                        };
                    }
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
            ToastUser.fire({
                title: 'Profil Diperbarui!',
                text: 'Perubahan data akun Anda telah berhasil disimpan ke sistem.',
                icon: 'success',
                iconColor: '#10b981'
            });
            fetchDashboardData(user.nik);
        } else {
            ToastUser.fire({
                title: 'Gagal Menyimpan',
                text: 'Terjadi kesalahan saat memperbarui profil Anda. Silakan coba lagi.',
                icon: 'error',
                iconColor: '#f43f5e'
            });
        }
    };

    const handleNewBooking = async (e) => {
        e.preventDefault();
        const kodeBooking = `SQ-${Date.now()}`;
        const isoStringTime = new Date().toISOString();

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

            if (insertError) throw new Error(insertError.message);

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
                created_at: isoStringTime,
                tanda_tangan_url: user.tanda_tangan_url
            };

            const kirimAntreanLatarBelakang = async () => {
                try {
                    await fetch('/api/kunjungan-baru', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(dataKunjunganBaru),
                        signal: AbortSignal.timeout(5000)
                    });
                } catch (error) {
                    console.error("Gagal sinkronisasi data latar belakang:", error);
                }
            };

            kirimAntreanLatarBelakang();

            setHistory((prevHistory) => [
                { ...dataKunjunganBaru, qr_url: qrBase64 },
                ...prevHistory
            ]);

            setBookingForm({ keperluan: '', menemui: '' });
            setActiveTab('riwayat');

            ToastUser.fire({
                title: 'Sowan Berhasil Dibuat!',
                text: 'Kode QR Anda telah diterbitkan. Silakan periksa tab riwayat.',
                icon: 'success',
                iconColor: '#10b981'
            });

        } catch (error) {
            console.error("Gagal membuat booking baru:", error);
            ToastUser.fire({
                title: 'Gagal Membuat Sowan!',
                text: `Pesan Error: ${error.message}`,
                icon: 'error',
                iconColor: '#f43f5e'
            });
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('user_nik');
        router.push('/');
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center font-bold">Memuat Dashboard...</div>;

    const getGreetingKey = () => {
        const hour = new Date().getHours();
        if (hour < 11) return 'morning';
        if (hour < 15) return 'day';
        if (hour < 18) return 'afternoon';
        return 'night';
    };
    const currentGreeting = t[getGreetingKey()] || 'Selamat';

    return (
        <div className={`flex min-h-screen relative overflow-hidden transition-all duration-500 ease-in-out ${isDarkMode
            ? 'bg-slate-950 text-sky-100'
            : 'bg-slate-50 text-slate-800'
            }`}>
            
            <div className="absolute inset-0 pointer-events-none z-0 opacity-50 dark:opacity-35">
                <Aurora
                    colorStops={["#0ea5e9", "#6366f1", "#a855f7"]} // Kombinasi warna Biru, Indigo, & Ungu
                    blend={0.5}
                    amplitude={1.0}
                    speed={0.6}
                />
            </div>

            <aside className="w-64 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-xl hidden md:flex flex-col border-r border-slate-200/40 dark:border-slate-800/40 z-10 transition-colors">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800/80">
                    <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-600 via-indigo-600 to-blue-500 dark:from-sky-400 dark:via-sky-200 dark:to-white">
                        SowanQR
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">{t.welcomeDash}</p>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    <button onClick={() => setActiveTab('beranda')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'beranda' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 dark:bg-sky-500 dark:text-slate-950' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'}`}>
                        <HomeIcon className="w-4 h-4" /> {t.homeDash}
                    </button>
                    <button onClick={() => setActiveTab('riwayat')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'riwayat' ? 'bg-yellow-900 text-white shadow-lg shadow-yellow-600/20 dark:bg-yellow-500 dark:text-slate-950' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'}`}>
                        <ClipboardList className="w-4 h-4" /> {t.historyDash}
                    </button>
                    <button onClick={() => setActiveTab('pengaturan')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'pengaturan' ? 'bg-red-800 text-white shadow-lg shadow-red-600/20 dark:bg-red-500 dark:text-slate-950' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'}`}>
                        <Settings className="w-4 h-4" /> {t.settingDash}
                    </button>
                </nav>
            </aside>

            {/* KONTEN UTAMA */}
            <main className="flex-1 p-6 sm:p-10 overflow-y-auto pb-24 md:pb-10 z-10">
                <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100">
                            {greeting}, <span className="text-indigo-600 dark:text-sky-400">{user?.nama?.split(' ')[0]}!</span>
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">{t.welcome}</p>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={toggleLanguage} className="px-3 py-2 text-xs font-black rounded-xl bg-white/80 dark:bg-slate-900/80 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-800/60 shadow-sm backdrop-blur transition active:scale-95">
                            {lang === 'id' ? 'EN' : 'ID'}
                        </button>
                        <button onClick={toggleDarkMode} className="p-2.5 text-sm font-bold rounded-xl bg-white/80 dark:bg-slate-900/80 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-800/60 shadow-sm backdrop-blur transition-all hover:scale-105 active:scale-95">
                            {isDarkMode ? <SunIcon className='w-4 h-4'></SunIcon> : <MoonIcon className='w-4 h-4'></MoonIcon>}
                        </button>
                    </div>
                </header>

                {/* TAB BERANDA */}
                {activeTab === 'beranda' && (
                    <div className="space-y-6">
                         <div className="lg:col-span-1 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/40 dark:border-slate-800/40 shadow-xl rounded-2xl p-6 h-fit">
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-4">{t.createS}</h3>
                            <form onSubmit={handleNewBooking} className="space-y-4">
                                <div>
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t.labelKeperluan}</label>
                                    <input type="text" required value={bookingForm.keperluan} onChange={(e) => setBookingForm({ ...bookingForm, keperluan: e.target.value })} className="w-full mt-1 px-4 py-2.5 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:focus:ring-sky-500 text-slate-800 dark:text-slate-100 outline-none transition-all" placeholder={t.placeholderKeperluan} />
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t.labelMenemui}</label>
                                    <input type="text" required value={bookingForm.menemui} onChange={(e) => setBookingForm({ ...bookingForm, menemui: e.target.value })} className="w-full mt-1 px-4 py-2.5 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:focus:ring-sky-500 text-slate-800 dark:text-slate-100 outline-none transition-all" placeholder={t.placeholderMenemui} />
                                </div>
                                <button type="submit" className="w-full bg-indigo-600 dark:bg-sky-500 text-white dark:text-slate-950 font-black py-3 rounded-xl hover:opacity-90 shadow-md transition-all active:scale-[0.98]">{t.btnSubmit}</button>
                            </form>
                        </div>

                        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-6 rounded-2xl shadow-md border border-slate-200/40 dark:border-slate-800/40">
                            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-4">{t.announcement}</h3>
                            <div className="space-y-4">
                                <article className="bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 shadow-sm rounded-2xl p-6 transition-all duration-300 hover:shadow-md">
                                    <span className="text-xs font-extrabold text-indigo-600 dark:text-sky-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-md">Info Pendidikan</span>
                                    <h4 className="font-bold text-slate-800 dark:text-slate-200 mt-2">Kebijakan Baru Kunjungan Sekolah</h4>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">Mulai bulan depan, seluruh tamu diwajibkan menunjukkan QR Code aktif yang berwarna Hijau (Sudah Di-scan) sebelum memasuki area tata usaha. Hal ini bertujuan untuk meningkatkan keamanan instansi.</p>
                                </article>
                                <article className="bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 shadow-sm rounded-2xl p-6 transition-all duration-300 hover:shadow-md">
                                    <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-md">Info Tugas</span>
                                    <h4 className="font-bold text-slate-800 dark:text-slate-200 mt-2">PJBL (Project-Based Learning)</h4>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">PjBL (Project-Based Learning) adalah metode pembelajaran di mana siswa belajar secara aktif dengan memecahkan masalah dunia nyata melalui pengerjaan proyek yang kompleks hingga menghasilkan sebuah produk fungsional.</p>
                                </article>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB RIWAYAT & BOOKING */}
                {activeTab === 'riwayat' && (
                    <div className="grid lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/40 dark:border-slate-800/40 shadow-xl rounded-2xl p-6 h-fit">
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-4">{t.createS}</h3>
                            <form onSubmit={handleNewBooking} className="space-y-4">
                                <div>
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t.labelKeperluan}</label>
                                    <input type="text" required value={bookingForm.keperluan} onChange={(e) => setBookingForm({ ...bookingForm, keperluan: e.target.value })} className="w-full mt-1 px-4 py-2.5 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:focus:ring-sky-500 text-slate-800 dark:text-slate-100 outline-none transition-all" placeholder={t.placeholderKeperluan} />
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t.labelMenemui}</label>
                                    <input type="text" required value={bookingForm.menemui} onChange={(e) => setBookingForm({ ...bookingForm, menemui: e.target.value })} className="w-full mt-1 px-4 py-2.5 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:focus:ring-sky-500 text-slate-800 dark:text-slate-100 outline-none transition-all" placeholder={t.placeholderMenemui} />
                                </div>
                                <button type="submit" className="w-full bg-indigo-600 dark:bg-sky-500 text-white dark:text-slate-950 font-black py-3 rounded-xl hover:opacity-90 shadow-md transition-all active:scale-[0.98]">{t.btnSubmit}</button>
                            </form>
                        </div>

                        {/* List Riwayat */}
                        <div className="lg:col-span-2 space-y-4">
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">{t.yourHistory}</h3>
                            {history.length === 0 ? (
                                <p className="text-slate-500 font-medium">{t.yourvisits}</p>
                            ) : (
                                history.map((item, idx) => (
                                    <div key={idx} className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-5 rounded-2xl shadow-md border border-slate-200/40 dark:border-slate-800/40 flex flex-col md:flex-row gap-5 items-center md:items-start text-center md:text-left transition-all">
                                        <div className="flex flex-col items-center gap-2 bg-white/80 dark:bg-slate-950/80 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800 w-full md:w-auto max-w-[200px] md:max-w-none mx-auto md:mx-0 shadow-sm">
                                            <img src={item.qr_url} alt="QR Code" className="w-24 h-24 rounded-lg border border-slate-200 bg-white p-1" />
                                            <div className="flex gap-1.5 w-full justify-center">
                                                <button type="button" onClick={() => downloadQR(item.qr_url, item.kode)} className="text-[11px] font-extrabold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-400 px-2.5 py-1.5 rounded-md hover:opacity-80 transition-all flex-1 text-center">
                                                    Download
                                                </button>
                                                <button type="button" onClick={() => { setSelectedQr({ qr_url: item.qr_url, kode: item.kode, keperluan: item.keperluan }); setIsQrModalOpen(true); }} className="text-[11px] font-extrabold text-white bg-indigo-600 dark:bg-sky-500 dark:text-slate-950 px-2.5 py-1.5 rounded-md hover:opacity-90 transition-all flex-1 text-center">
                                                    Scan
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex-1 w-full flex flex-col items-center md:items-start justify-center md:justify-start">
                                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-2 w-full">
                                                <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400 bg-white/80 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/40 dark:border-slate-700/40">{item.kode}</span>
                                                {item.status?.toLowerCase() === 'selesai' ? (
                                                    <span className="px-2.5 py-0.5 bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400 text-xs font-extrabold rounded-full">{t.statusSelesai || 'Selesai'}</span>
                                                ) : item.status?.toLowerCase() === 'scanned' || item.status?.toLowerCase() === 'hadir' ? (
                                                    <span className="px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 text-xs font-extrabold rounded-full">{t.qr}</span>
                                                ) : (
                                                    <span className="px-2.5 py-0.5 bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 text-xs font-extrabold rounded-full">{t.waiting}</span>
                                                )}
                                            </div>
                                            <h4 className="font-black text-slate-800 dark:text-slate-200 text-lg w-full">{item.keperluan}</h4>
                                            <p className="text-sm text-slate-600 dark:text-slate-400 w-full mt-0.5">
                                                {t.menemui}: <span className="font-bold text-slate-800 dark:text-slate-300">{item.menemui}</span>
                                            </p>
                                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 font-medium w-full">
                                                {t.made}: {new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* TAB PENGATURAN */}
                {activeTab === 'pengaturan' && (
                    <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-slate-200/40 dark:border-slate-800/40 max-w-2xl">
                        <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-6">{t.profile}</h3>
                        <form onSubmit={handleUpdateProfile} className="space-y-4">
                            <div>
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t.NIKpro}</label>
                                <input type="text" disabled value={editForm.nik || ''} className="w-full mt-1 px-4 py-3 bg-white/40 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 dark:text-slate-500 cursor-not-allowed outline-none font-semibold" />
                            </div>
                            <div>
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t.labelNama}</label>
                                <input type="text" value={editForm.nama || ''} onChange={e => setEditForm({ ...editForm, nama: e.target.value })} className="w-full mt-1 px-4 py-3 bg-white/20 dark:bg-transparent border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:focus:ring-sky-500 text-slate-800 dark:text-slate-100 outline-none transition-all font-medium" />
                            </div>
                            <div>
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t.labelWa}</label>
                                <input type="text" value={editForm.whatsapp || ''} onChange={e => setEditForm({ ...editForm, whatsapp: e.target.value })} className="w-full mt-1 px-4 py-3 bg-white/20 dark:bg-transparent border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:focus:ring-sky-500 text-slate-800 dark:text-slate-100 outline-none transition-all font-medium" />
                            </div>
                            <div>
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t.labelEmail}</label>
                                <input type="email" value={editForm.email || ''} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="w-full mt-1 px-4 py-3 bg-white/20 dark:bg-transparent border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:focus:ring-sky-500 text-slate-800 dark:text-slate-100 outline-none transition-all font-medium" />
                            </div>

                            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3 items-center w-full">
                                <button type="submit" className="w-full sm:w-auto bg-indigo-600 dark:bg-sky-500 text-white dark:text-slate-950 font-black px-8 py-3 rounded-xl hover:opacity-90 transition-all text-sm shadow-md active:scale-95 text-center">
                                    {t.save}
                                </button>
                                <button type="button" onClick={handleLogout} className="w-full sm:w-auto px-8 py-3 text-rose-600 dark:text-rose-400 font-black hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all text-sm border border-transparent hover:border-rose-200 dark:hover:border-rose-900 text-center active:scale-95">
                                    <ExternalLinkIcon className="w-4 h-4 inline mr-2 -mt-0.5" />
                                    {t.keluar}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </main>

            {/* NAV BOTTOM MOBILE */}
            <nav className="md:hidden fixed bottom-0 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-800/50 flex justify-around p-3.5 z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.08)]">
                <button onClick={() => setActiveTab('beranda')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'beranda' ? 'text-indigo-600 dark:text-sky-400 scale-110' : 'text-slate-400 dark:text-slate-500'}`}>
                    <HomeIcon className="w-5 h-5" />
                </button>
                <button onClick={() => setActiveTab('riwayat')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'riwayat' ? 'text-indigo-600 dark:text-sky-400 scale-110' : 'text-slate-400 dark:text-slate-500'}`}>
                    <ClipboardList className="w-5 h-5" />
                </button>
                <button onClick={() => setActiveTab('pengaturan')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'pengaturan' ? 'text-indigo-600 dark:text-sky-400 scale-110' : 'text-slate-400 dark:text-slate-500'}`}>
                    <Settings className="w-5 h-5" />
                </button>
            </nav>

            {/* MODAL SCAN QR */}
            {isQrModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md transition-all">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl border border-slate-200 dark:border-slate-800 transform scale-100 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                            <div className="text-left">
                                <h4 className="font-black text-slate-800 dark:text-slate-200 text-base">{t.qrScan}</h4>
                                <p className="text-xs text-slate-400 font-semibold">{t.labelQr}</p>
                            </div>
                            <button onClick={() => setIsQrModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-bold flex items-center justify-center text-xl transition-all">&times;</button>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-inner flex flex-col items-center justify-center my-4">
                            <img src={selectedQr.qr_url} alt="QR Code Perbesar" className="w-56 h-56 rounded-xl border border-slate-200 bg-white p-2 shadow-sm" />
                        </div>
                        <div className="bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl p-3 border border-indigo-100/50 dark:border-indigo-900/50 mb-4 text-left">
                            <div className="text-[10px] uppercase tracking-wider font-black text-indigo-600 dark:text-sky-400">{t.labelKeperluan}</div>
                            <div className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{selectedQr.keperluan}</div>
                            <div className="text-[10px] uppercase tracking-wider font-black text-slate-400 mt-2">Kode</div>
                            <div className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400 tracking-widest">{selectedQr.kode}</div>
                        </div>
                        <button onClick={() => setIsQrModalOpen(false)} className="w-full bg-indigo-600 dark:bg-sky-500 text-white dark:text-slate-950 font-black py-3 rounded-xl transition shadow-md text-sm">{t.clear}</button>
                    </div>
                </div>
            )}
        </div>
    );
}