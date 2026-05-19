'use client';
import { useState } from 'react';

export default function Home() {
  const [form, setForm] = useState({ nama: '', instansi: '', whatsapp: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const downloadQR = () => {
    const link = document.createElement('a');
    link.href = result.qr;
    link.download = `QR-SowanQR-${result.code}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.success) setResult(data);
    } catch (err) {
      alert('Gagal mendaftar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen relative flex items-center justify-center p-4 sm:p-8 overflow-hidden bg-slate-50">

      {/* Efek Latar Belakang (Subtle Gradient orbs) */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-indigo-300/30 blur-[100px]"></div>
        <div className="absolute top-[60%] -right-[10%] w-[40%] h-[40%] rounded-full bg-cyan-300/30 blur-[100px]"></div>
      </div>

      {/* Kartu Utama (Glassmorphism ringan) */}
      <div className="relative z-10 bg-white/80 backdrop-blur-xl p-8 sm:p-10 rounded-[2rem] shadow-2xl shadow-indigo-100/60 w-full max-w-lg border border-white">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600 tracking-tight mb-2">
            SowanQR
          </h1>
          <p className="text-sm font-medium text-slate-500">Sistem Buku Tamu & Reservasi Digital</p>
        </div>

        {!result ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">Nama Lengkap</label>
              <input type="text" required
                className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all duration-200 text-slate-700 placeholder-slate-400"
                placeholder="Masukkan nama Anda"
                onChange={e => setForm({ ...form, nama: e.target.value })} />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">Instansi / Sekolah</label>
              <input type="text" required
                className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all duration-200 text-slate-700 placeholder-slate-400"
                placeholder="Asal instansi"
                onChange={e => setForm({ ...form, instansi: e.target.value })} />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">No. WhatsApp</label>
              <input type="text" required
                className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all duration-200 text-slate-700 placeholder-slate-400"
                placeholder="Contoh: 628123456789"
                onChange={e => setForm({ ...form, whatsapp: e.target.value })} />
            </div>

            <button type="submit" disabled={loading}
              className="w-full mt-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-indigo-200 transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Memproses...
                </span>
              ) : 'Dapatkan QR Code'}
            </button>
          </form>
        ) : (
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center p-3 bg-emerald-100 rounded-full mb-2">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-slate-800">Pendaftaran Berhasil!</h3>
              <p className="text-sm text-slate-500 mt-1">Simpan QR Code ini untuk ditunjukkan ke petugas.</p>
            </div>

            <div className="relative bg-white p-5 rounded-2xl shadow-sm border border-slate-100 inline-block">
              <img src={result.qr} alt="QR Code Booking" className="mx-auto w-48 h-48 rounded-lg" />
              <p className="font-mono text-xs font-bold text-slate-400 mt-4 tracking-widest">{result.code}</p>
            </div>

            <div className="flex flex-col gap-3 mt-4">
              <button onClick={downloadQR}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-200 transition-all duration-300 transform hover:-translate-y-0.5">
                Simpan ke Galeri
              </button>
              <button onClick={() => setResult(null)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3.5 px-4 rounded-xl transition-all duration-300">
                Daftar Tamu Lain
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}