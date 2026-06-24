'use client';
import { useState, useEffect } from 'react';
import { QrCodeIcon, CheckCircle2, Clock, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Swal from 'sweetalert2';
import Beams from '@/components/ui/beams';

export default function GuestExpressCheckIn() {
  const [loading, setLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState(null);
  const [liveStatus, setLiveStatus] = useState('Pending'); // State untuk memantau status QR
  const [form, setForm] = useState({
    nama: '',
    instansi: '',
    menemui: '',
    keperluan: ''
  });

  // EFFECT: Polling status database setiap 2 detik jika QR sudah digenerate
  useEffect(() => {
    if (!generatedCode) return;

    // Fungsi cek status ke Supabase
    const checkTicketStatus = async () => {
      const { data, error } = await supabase
        .from('kunjungan_tamu')
        .select('status')
        .eq('kode', generatedCode)
        .maybeSingle();

      if (!error && data) {
        setLiveStatus(data.status);
      }
    };

    const interval = setInterval(checkTicketStatus, 2000); // Cek setiap 2 detik
    return () => clearInterval(interval);
  }, [generatedCode]);

  const handleExpressSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Buat Kode Tiket Unik Eksklusif Guest
      const randomString = Math.random().toString(36).substring(2, 6).toUpperCase();
      const kodeBooking = `EXPR-${Date.now()}-${randomString}`;
      
      // Buat NIK Otomatis khusus mode express mandiri
      const guestNik = 'EXPR-' + Math.floor(100000 + Math.random() * 900000);

      // 2. Simpan Data Profil Tamu Mandiri ke Supabase
      const { error: profError } = await supabase
        .from('profil_tamu')
        .insert([{
          nik: guestNik,
          nama: form.nama.trim(),
          instansi: form.instansi.trim() || 'Umum',
          whatsapp: `EXPR-${guestNik}`,
          email: null,
          tanda_tangan: 'EXPRESS'
        }]);

      if (profError) throw profError;

      // 3. Simpan Data Kunjungan ke Supabase
      const { error: kunjError } = await supabase
        .from('kunjungan_tamu')
        .insert([{
          nik: guestNik,
          kode: kodeBooking,
          menemui: form.menemui.trim(),
          keperluan: form.keperluan.trim(),
          status: 'Pending',
          waktu_hadir: '-'
        }]);

      if (kunjError) throw kunjError;

      // Sukses! Set Kode untuk menampilkan QR di layar
      setGeneratedCode(kodeBooking);
      setLiveStatus('Pending'); // Reset ke awal

      Swal.fire({
        icon: 'success',
        title: 'Tiket QR Berhasil Dibuat!',
        text: 'Silakan tunjukkan QR Code ini ke petugas gerbang.',
        background: '#0f172a',
        color: '#f8fafc',
        confirmButtonColor: '#0284c7'
      });

    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Gagal Memproses',
        text: err.message || 'Terjadi kesalahan sistem.',
        background: '#0f172a',
        color: '#f8fafc'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setGeneratedCode(null);
    setLiveStatus('Pending');
    setForm({ nama: '', instansi: '', menemui: '', keperluan: '' });
  };

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${generatedCode}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 antialiased selection:bg-sky-500/30">
          <div className="fixed inset-0 w-screen h-screen z-0 pointer-events-none opacity-40 dark:opacity-100 transition-opacity">
                <Beams className="w-full h-full" />
              </div>
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">

        
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-sky-500/10 blur-3xl rounded-full"></div>

        {/* HEADER */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-sky-500/10 border border-sky-500/20 rounded-xl flex items-center justify-center text-sky-400">
            <QrCodeIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide text-white">SowanQR Express</h1>
            <p className="text-xs text-slate-400 font-medium">Registrasi Mandiri</p>
          </div>
        </div>

        {/* ALUR 1: FORM PENGISIAN TAMU */}
        {!generatedCode ? (
          <form onSubmit={handleExpressSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Nama Lengkap *</label>
              <input 
                type="text" 
                required 
                value={form.nama} 
                onChange={(e) => setForm({ ...form, nama: e.target.value })} 
                className="w-full p-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:border-sky-500 focus:outline-none transition-all placeholder-slate-600" 
                placeholder="Masukkan nama Anda" 
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Asal Instansi / Sekolah</label>
              <input 
                type="text" 
                value={form.instansi} 
                onChange={(e) => setForm({ ...form, instansi: e.target.value })} 
                className="w-full p-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:border-sky-500 focus:outline-none transition-all placeholder-slate-600" 
                placeholder="Contoh: Universitas / SMK Pasundan (Opsional)" 
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Siapa Yang Menemui? *</label>
                <input 
                  type="text" 
                  required 
                  value={form.menemui} 
                  onChange={(e) => setForm({ ...form, menemui: e.target.value })} 
                  className="w-full p-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:border-sky-500 focus:outline-none transition-all placeholder-slate-600" 
                  placeholder="Contoh: Petugas Stan / Guru" 
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Keperluan *</label>
                <input 
                  type="text" 
                  required 
                  value={form.keperluan} 
                  onChange={(e) => setForm({ ...form, keperluan: e.target.value })} 
                  className="w-full p-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:border-sky-500 focus:outline-none transition-all placeholder-slate-600" 
                  placeholder="Contoh: Kunjungan / Coba Demo" 
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full py-3 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-xl tracking-wide transition-all shadow-lg shadow-sky-600/10 active:scale-[0.99]"
            >
              {loading ? 'Sedang Memproses Tiket...' : 'Dapatkan QR Code Akses'}
            </button>
          </form>
        ) : (
          
          /* ALUR 2: TAMPILAN TIKET QR KETIKA SELESAI + BADGE STATUS LIVE */
          <div className="flex flex-col items-center text-center space-y-5 py-2">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 animate-pulse" />
            </div>

            <div>
              <h2 className="text-sm font-bold text-white">Akses Express Diberikan!</h2>
              <p className="text-xs text-slate-400 max-w-[280px] mx-auto mt-1">Silakan tunjukkan QR ini ke petugas gerbang pameran.</p>
            </div>

            {/* QR Container Frame */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 inline-block shadow-inner relative">
              <img 
                src={qrImageUrl} 
                alt="Express QR Code" 
                className="w-[200px] h-[200px]" 
              />
              <p className="text-[12px] font-mono font-bold text-slate-900 mt-2 tracking-widest">{generatedCode}</p>
            </div>

            {/* LIVE STATUS CONTAINER (Disesuaikan Gaya Dashboard Admin) */}
            <div className="w-full bg-slate-950/60 border border-slate-850 p-3 rounded-xl flex items-center justify-between px-4">
              <span className="text-xs font-semibold text-slate-400">Status Kehadiran:</span>
              <div className="flex items-center gap-1.5">
                {liveStatus === 'Hadir' || liveStatus === 'Selesai' ? (
                  <span className="flex items-center gap-1 px-3 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle className="w-3 h-3" /> HADIR
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-3 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Clock className="w-3 h-3 animate-spin-[spin_3s_linear_infinite]" /> PENDING
                  </span>
                )}
              </div>
            </div>

            {/* Tombol aksi mandiri */}
            <div className="w-full space-y-2 pt-1">
              <button 
                onClick={resetForm} 
                className="w-full py-2.5 bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-white border border-slate-800 text-xs font-semibold rounded-xl transition-all"
              >
                Buat Tiket Baru Lagi
              </button>
            </div>
          </div>
        )}
      </div>
      
      <p className="text-[10px] text-slate-600 mt-4 tracking-wide font-medium">Powered by SowanQR System v1.0</p>
    </div>
  );
}