'use client';
import SignatureCanvas from 'react-signature-canvas';
import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState('register');
  const [isVerified, setIsVerified] = useState(false);  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [mounted, setMounted] = useState(false);
  
  const [form, setForm] = useState({
    nama: '',
    instansi: '',
    whatsapp: '',
    nik: '',
    email: '',
    keperluan: '',
    menemui: ''
  });

  const sigCanvas = useRef({});

  useEffect(() => {
    setMounted(true);
    const existingSession = localStorage.getItem('user_nik');
    if (existingSession) {
      router.push('/dashboard');
    }
  }, [router]);
  
  const downloadQR = () => {
    const link = document.createElement('a');
    link.href = result.qr;
    link.download = `QR-SowanQR-${result.code}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleVerifyUser = async () => {
    if (!form.nik || !form.whatsapp) {
      alert('Mohon isi NIK dan Nomor WhatsApp Anda terlebih dahulu!');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nik: form.nik, whatsapp: form.whatsapp, isVerifying: true })
      });
      const data = await res.json();
      if (data.success) {
        setIsVerified(true);
        setForm(prev => ({ ...prev, nama: data.profil.nama, email: data.profil.email }));
        alert(`Selamat datang kembali, ${data.profil.nama}! Silakan isi keperluan kunjungan Anda.`);
      } else {
        alert(data.message || 'Data tidak ditemukan. Silakan mendaftar sebagai Tamu Baru.');
      }
    } catch (err) {
      alert('Gagal memverifikasi data.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    let targetApi = '/api/auth/register';
    let bodyData = { ...form };

    if (authMode === 'register') {
      if (sigCanvas.current.isEmpty()) {
        alert('Mohon isi tanda tangan terlebih dahulu!');
        return;
      }
      const base64Image = sigCanvas.current.toDataURL();
      bodyData.tandaTanganBase64 = base64Image;
    } else {
      targetApi = '/api/auth/login';
      bodyData.isVerifying = false;
    }

    setLoading(true);
    try {
      const res = await fetch(targetApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
      const data = await res.json();
      
      if (data.success) {
        localStorage.setItem('user_nik', form.nik);
        setResult(data);
      } else {
        alert(data.error || 'Terjadi kesalahan sistem.');
      }
    } catch (err) {
      alert('Gagal memproses pendaftaran.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoToDashboard = () => {
    router.push('/dashboard');
  };

  if (!mounted) return null;

  return (
    <main className="min-h-screen relative flex items-center justify-center p-4 sm:p-8 bg-slate-50">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-indigo-300/30 blur-[100px]"></div>
        <div className="absolute top-[60%] -right-[10%] w-[40%] h-[40%] rounded-full bg-cyan-300/30 blur-[100px]"></div>
      </div>

      <div className="relative z-10 bg-white/80 backdrop-blur-xl p-8 sm:p-10 rounded-[2rem] shadow-2xl shadow-indigo-100/60 w-full max-w-lg border border-white">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600 tracking-tight mb-2">
            SowanQR
          </h1>
          <p className="text-sm font-medium text-slate-500">Sistem Buku Tamu & Reservasi Digital</p>
        </div>

        {!result ? (
          <div>
            <div className="flex bg-slate-100/80 p-1 rounded-xl mb-6 border border-slate-200" suppressHydrationWarning>
              <button type="button"
                suppressHydrationWarning
                onClick={() => { setAuthMode('register'); setIsVerified(false); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${authMode === 'register' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}>
                Tamu Baru (Daftar)
              </button>
              <button type="button"
                suppressHydrationWarning
                onClick={() => { setAuthMode('login'); setIsVerified(false); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${authMode === 'login' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}>
                Tamu Lama (Login)
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">NIK</label>
                <input type="text" required value={form.nik}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-700"
                  placeholder="Masukkan NIK Anda"
                  onChange={e => setForm({ ...form, nik: e.target.value })} />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">No. WhatsApp</label>
                <input type="text" required value={form.whatsapp}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-700"
                  placeholder="Contoh: 628123456789"
                  onChange={e => setForm({ ...form, whatsapp: e.target.value })} />
              </div>

              {authMode === 'login' && !isVerified && (
                <button type="button" onClick={handleVerifyUser} disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-md">
                  {loading ? 'Memverifikasi...' : 'Cek Data Profil'}
                </button>
              )}

              {(authMode === 'register' || (authMode === 'login' && isVerified)) && (
                <>
                  {authMode === 'register' && (
                    <>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-semibold text-slate-700">Nama Lengkap</label>
                        <input type="text" required value={form.nama}
                          className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700"
                          placeholder="Masukkan nama lengkap"
                          onChange={e => setForm({ ...form, nama: e.target.value })} />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-sm font-semibold text-slate-700">Instansi / Sekolah</label>
                        <input type="text" required value={form.instansi}
                          className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700"
                          placeholder="Asal instansi"
                          onChange={e => setForm({ ...form, instansi: e.target.value })} />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-sm font-semibold text-slate-700">Email</label>
                        <input type="email" required value={form.email}
                          className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700"
                          placeholder="nama@email.com"
                          onChange={e => setForm({ ...form, email: e.target.value })} />
                      </div>
                    </>
                  )}

                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-slate-700">Keperluan</label>
                    <input type="text" required value={form.keperluan}
                      className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700"
                      placeholder="Contoh: Koordinasi Projek / Rapat Dinas"
                      onChange={e => setForm({ ...form, keperluan: e.target.value })} />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-slate-700">Ingin Menemui Siapa</label>
                    <input type="text" required value={form.menemui}
                      className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700"
                      placeholder="Nama Guru / Staff"
                      onChange={e => setForm({ ...form, menemui: e.target.value })} />
                  </div>

                  {authMode === 'register' && (
                    <div className="space-y-1.5">
                      <label className="block text-sm font-semibold text-slate-700">Tanda Tangan Digital</label>
                      <div className="border-2 border-dashed border-slate-200 rounded-xl overflow-hidden bg-white">
                        <SignatureCanvas
                          ref={sigCanvas}
                          penColor="black"
                          canvasProps={{ className: 'w-full h-40 sigCanvas' }}
                        />
                      </div>
                      <button type="button" onClick={() => sigCanvas.current.clear()}
                        className="block text-xs font-semibold text-rose-500 hover:underline">
                        Bersihkan Ulang Tanda Tangan
                      </button>
                    </div>
                  )}

                  <button type="submit" disabled={loading}
                    className="w-full mt-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-100 disabled:opacity-70 transition-all">
                    {loading ? 'Sedang Memproses...' : 'Dapatkan QR Code'}
                  </button>
                </>
              )}
            </form>
          </div>
        ) : (
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center p-3 bg-emerald-100 rounded-full mb-2">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-slate-800">Tiket Kunjungan Berhasil!</h3>
              <p className="text-sm text-slate-500 mt-1">Tunjukkan QR Code ini kepada petugas gerbang/resepsionis.</p>
            </div>

            <div className="relative bg-white p-5 rounded-2xl border border-slate-100 inline-block shadow-sm">
              <img src={result.qr} alt="QR Code" className="mx-auto w-48 h-48 rounded-lg" />
              <p className="font-mono text-xs font-bold text-slate-400 mt-4 tracking-widest">{result.code}</p>
            </div>

            <div className="flex flex-col gap-3 mt-4">
              <button onClick={downloadQR}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-100 transition-all">
                Simpan ke Galeri
              </button>
              <button onClick={handleGoToDashboard}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-md">
                ➡️ Selanjutnya ke Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}