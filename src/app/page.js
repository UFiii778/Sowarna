'use client';
import SignatureCanvas from 'react-signature-canvas';
import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { dictionary } from '@/constants/languages';

export default function Home() {
  const router = useRouter();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [lang, setLang] = useState('id'); // 'id' atau 'en'
  const t = dictionary[lang];
  const [authMode, setAuthMode] = useState('register');
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);
  const [animationType, setAnimationType] = useState('success');
  const [errorMsg, setErrorMsg] = useState('');

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
      alert(t.peringatan);
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
        localStorage.setItem('user_nik', data.profil.nik);
        localStorage.setItem('user_nama', data.profil.nama);

        setAnimationType('success');
        setErrorMsg('');
        setShowAnimation(true);

        setTimeout(() => {
          setShowAnimation(false);
          router.push('/dashboard');
        }, 2000);

      } else {
        setAnimationType('error');
        setErrorMsg(data.message || t.dataF );
        setShowAnimation(true);
        setTimeout(() => setShowAnimation(false), 2500);
      }
    } catch (err) {
      setAnimationType('error');
      setErrorMsg('Gagal memverifikasi data profil.');
      setShowAnimation(true);
      setTimeout(() => setShowAnimation(false), 2500);
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
        alert(t.handC);
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
        alert(data.error || t.errorA );
      }
    } catch (err) {
      alert(t.errorR);
    } finally {
      setLoading(false);
    }
  };

  const handleGoToDashboard = () => {
    router.push('/dashboard');
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

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

  if (!mounted) return null;

  return (
    <main className="min-h-screen relative flex items-center justify-center p-4 sm:p-8 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-indigo-300/30 blur-[100px]"></div>
        <div className="absolute top-[60%] -right-[10%] w-[40%] h-[40%] rounded-full bg-cyan-300/30 blur-[100px]"></div>
      </div>

      <div className="relative z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-8 sm:p-10 rounded-[2rem] shadow-2xl shadow-indigo-100/60 dark:shadow-none w-full max-w-lg border border-white dark:border-slate-800 transition-colors duration-300">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600 tracking-tight mb-2">
            SowanQR
          </h1>
          <h2 className="text-sm font-medium text-slate-700 dark:text-white">{t.subtitle}</h2>
        </div>

        {!result ? (
          <div>
            <div className="flex justify-between items-center mb-4">
              <button
                type="button"
                onClick={() => setLang(lang === 'id' ? 'en' : 'id')}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition"
              >
                🌐 {lang === 'id' ? 'EN' : 'ID'}
              </button>

              <button
                type="button"
                onClick={toggleDarkMode}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition"
              >
                {isDarkMode ? 'Day Mode' : 'Night Mode'}
              </button>
            </div>
            
            <div className="flex bg-slate-100/80 dark:bg-slate-800 p-1 rounded-xl mb-6 border border-slate-200 dark:border-slate-700">
              <button type="button"
                onClick={() => { setAuthMode('register'); setIsVerified(false); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${authMode === 'register' ? 'bg-indigo-600 shadow text-white' : 'text-slate-800 hover:text-indigo-300 dark:text-slate-40 dark:hover:text-indigo-600 bg-white shadow'}`}>
                {t.tabNew}
              </button>
              <button type="button"
                onClick={() => { setAuthMode('login'); setIsVerified(false); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${authMode === 'login' ? 'bg-indigo-600 shadow text-white' : 'text-slate-800 hover:text-indigo-300 dark:text-slate-40 dark:hover:text-indigo-600 bg-white shadow'}`}>
                Login
              </button>
            </div>

            <div className="text-center mb-6">
              <h6 className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                {authMode === 'register' 
                  ? t.registerT
                  : t.loginT
                }
              </h6>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">{t.labelNik}</label>
                <input type="number" inputMode="numeric" required value={form.nik}
                  className="w-full px-4 py-3 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-700 dark:text-white"
                  placeholder={t.placeholderNik}
                  onChange={e => setForm({ ...form, nik: e.target.value })} />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">{t.labelWa}</label>
                <input type="number" inputMode="numeric" required value={form.whatsapp}
                  className="w-full px-4 py-3 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-700 dark:text-white"
                  placeholder={t.placeholderWa}
                  onChange={e => setForm({ ...form, whatsapp: e.target.value })} />
              </div>

              {authMode === 'login' && (
                <button type="button" onClick={handleVerifyUser} disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-md mt-2">
                  {loading ? t.btnChecking : t.btnCheck}
                </button>
              )}

              {authMode === 'register' && (
                <>
                  <div className="space-y-1.5 animate-in fade-in duration-300">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">{t.labelNama}</label>
                    <input type="text" required={authMode === 'register'} value={form.nama}
                      className="w-full px-4 py-3 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-700 dark:text-white"
                      placeholder={t.placeholderNama}
                      onChange={e => setForm({ ...form, nama: e.target.value })} />
                  </div>

                  <div className="space-y-1.5 animate-in fade-in duration-300">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">{t.labelInstansi}</label>
                    <input type="text" required={authMode === 'register'} value={form.instansi}
                      className="w-full px-4 py-3 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-700 dark:text-white"
                      placeholder={t.placeholderInstansi}
                      onChange={e => setForm({ ...form, instansi: e.target.value })} />
                  </div>

                  <div className="space-y-1.5 animate-in fade-in duration-300">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">{t.labelEmail}</label>
                    <input type="email" required={authMode === 'register'} value={form.email}
                      className="w-full px-4 py-3 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-700 dark:text-white"
                      placeholder="sowarna@email.com"
                      onChange={e => setForm({ ...form, email: e.target.value })} />
                  </div>

                  <div className="space-y-1.5 animate-in fade-in duration-300">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">{t.labelKeperluan}</label>
                    <input type="text" required={authMode === 'register'} value={form.keperluan}
                      className="w-full px-4 py-3 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-700 dark:text-white"
                      placeholder={t.placeholderKeperluan}
                      onChange={e => setForm({ ...form, keperluan: e.target.value })} />
                  </div>

                  <div className="space-y-1.5 animate-in fade-in duration-300">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">{t.labelMenemui}</label>
                    <input type="text" required={authMode === 'register'} value={form.menemui}
                      className="w-full px-4 py-3 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-700 dark:text-white"
                      placeholder={t.placeholderMenemui}
                      onChange={e => setForm({ ...form, menemui: e.target.value })} />
                  </div>

                  <div className="space-y-1.5 animate-in fade-in duration-300">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">{t.labelTtd}</label>
                    <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white">
                      <SignatureCanvas
                        ref={sigCanvas}
                        penColor="black"
                        canvasProps={{ className: 'w-full h-40 sigCanvas' }}
                      />
                    </div>
                    <button type="button" onClick={() => sigCanvas.current.clear()}
                      className="block text-xs font-semibold text-rose-500 hover:underline">
                      {t.btnClearTtd}
                    </button>
                  </div>

                  <button type="submit" disabled={loading}
                    className="w-full mt-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all">
                    {loading ? t.btnSubmitting : t.btnSubmit}
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
              <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-50">{t.ticketSuccess}</h3>
              <p className="text-sm text-slate-500 mt-1 dark:text-slate-50">{t.ticketDesc}</p>
            </div>

            <div className="relative bg-white p-5 rounded-2xl border border-slate-100 inline-block shadow-sm">
              <img src={result.qr} alt="QR Code" className="mx-auto w-48 h-48 rounded-lg" />
              <p className="font-mono text-xs font-bold text-slate-400 mt-4 tracking-widest">{result.code}</p>
            </div>

            <div className="flex flex-col gap-3 mt-4">
              <button onClick={downloadQR}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-100 transition-all">
                {t.btnGallery}
              </button>
              <button onClick={handleGoToDashboard}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-md">
                {t.btnDashboard}
              </button>
            </div>
          </div>
        )}
      </div>

      {showAnimation && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm transition-all duration-300">
          <div className={`p-8 rounded-3xl bg-white dark:bg-slate-900 border text-center shadow-2xl max-w-xs w-full mx-4 transform scale-100 transition-all duration-300 animate-in fade-in zoom-in-95 ${
            animationType === 'success' ? 'border-emerald-500/30 shadow-emerald-500/10' : 'border-rose-500/30 shadow-rose-500/10'
          }`}>
            <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-5 text-4xl font-extrabold animate-bounce ${
              animationType === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
            }`}>
              {animationType === 'success' ? '✓' : '✕'}
            </div>
            <h3 className={`text-xl font-black tracking-wide ${
              animationType === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}>
              {animationType === 'success' ? 'LOGIN BERHASIL!' : 'LOGIN GAGAL!'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium leading-relaxed">
              {animationType === 'success'
                ? 'Identitas Anda terverifikasi. Mengalihkan ke Dashboard Tamu...'
                : errorMsg || 'Terjadi kesalahan, silakan periksa kembali NIK Anda.'
              }
            </p>
          </div>
        </div>
      )}
    </main>
  );
}