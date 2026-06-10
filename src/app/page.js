'use client';
import SignatureCanvas from 'react-signature-canvas';
import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { dictionary } from '@/constants/languages';
import { LockIcon } from 'lucide-react';

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

  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpMethod, setOtpMethod] = useState('whatsapp'); // 'whatsapp' atau 'email'
  const [activeTargetWa, setActiveTargetWa] = useState('');
  const [activeTargetEmail, setActiveTargetEmail] = useState('');

  const [countdown, setCountdown] = useState(0); // Hitung mundur dalam detik

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

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
    console.log("Session ditemukan:", existingSession);
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

  // Fungsi Pemicu Kirim OTP untuk Mode REGISTER
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Set target aktif untuk verifikasi register
    setActiveTargetWa(form.whatsapp);
    setActiveTargetEmail(form.email);

    if (sigCanvas.current.isEmpty()) {
      alert(t.handC);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsapp: form.whatsapp,
          email: form.email,
          method: otpMethod
        })
      });

      const data = await res.json();

      if (data.success) {
        setIsOtpModalOpen(true);
        setCountdown(60);
        setOtpError('');
      } else {
        alert(data.message || 'Gagal mengirimkan kode verifikasi OTP.');
      }
    } catch (err) {
      console.error('Register OTP Send Error:', err);
      alert('Terjadi kesalahan jaringan saat mengirim OTP.');
    } finally {
      setLoading(false);
    }
  };

  // Fungsi khusus tombol Kirim Ulang OTP (Sekarang membaca dari activeTarget agar aman di kedua mode)
  const handleResendOtp = async () => {
    if (countdown > 0) return;

    setOtpLoading(true);
    setOtpError('');
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp: activeTargetWa, email: activeTargetEmail, method: otpMethod })
      });
      const data = await res.json();
      if (data.success) {
        setCountdown(60);
        alert('Kode OTP baru telah dikirim ulang!');
      } else {
        setOtpError(data.message);
      }
    } catch (err) {
      setOtpError('Gagal mengirim ulang OTP.');
    } finally {
      setOtpLoading(false);
    }
  };

  // Fungsi Pemicu Kirim OTP untuk Mode LOGIN
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    // 🔥 FIX: Set target aktif sebelum menembak API agar tidak kosong saat verifikasi OTP nanti
    setActiveTargetWa(whatsapp);
    setActiveTargetEmail(email);

    try {
      // Langkah A: Validasi kombinasi data ke API Login
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp, email }),
      });

      const loginData = await loginRes.json();

      if (!loginData.success) {
        setAnimationType('error');
        setErrorMsg(loginData.message || 'Data tidak cocok.');
        setShowAnimation(true);
        setTimeout(() => setShowAnimation(false), 3000);
        setLoading(false);
        return;
      }

      // Langkah B: Jika data terdaftar, kirim kode OTP secara otomatis
      const otpRes = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp, email, method: otpMethod }),
      });

      const otpData = await otpRes.json(); //

      if (otpData.success) { //
        const userNik = loginData.nik || loginData.profil?.nik; //

        if (userNik) {
          localStorage.setItem('temp_nik', userNik); //
        } else {
          console.error("Gagal menyimpan temp_nik: NIK tidak ditemukan di respon API login.");
        }

        setIsOtpModalOpen(true); //
        setCountdown(60); //
      } else {
        alert('Gagal mengirimkan kode OTP: ' + otpData.message); //
      }

    } catch (err) {
      console.error("Error Login Flow:", err);
      setErrorMsg('Terjadi masalah jaringan, silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmOtp = async () => {
    setOtpLoading(true);
    setOtpError('');
    try {
      // 1. Kirim payload yang match dengan route.js backend
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsapp: activeTargetWa,
          email: activeTargetEmail,
          method: otpMethod,    // 🔥 FIX: Kirim method ('whatsapp' / 'email')
          otpInput: otpInput    // 🔥 FIX: Gunakan nama 'otpInput' agar match dengan backend
        })
      });

      // 2. Parse response JSON secara aman ke dalam variabel 'data'
      const data = await res.json();

      if (data.success) {
        if (authMode === 'register') {
          // Ambil string data URL base64 tanda tangan dengan aman
          let ttdBase64 = null;
          if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
            ttdBase64 = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
          }

          const registerRes = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nik: form.nik,
              nama: form.nama,
              instansi: form.instansi,
              whatsapp: activeTargetWa,
              email: activeTargetEmail,
              menemui: form.menemui,
              keperluan: form.keperluan,
              ttd: ttdBase64
            })
          });

          const registerData = await registerRes.json();

          if (!registerData.success) {
            setOtpError(registerData.error || registerData.message || 'Gagal menyimpan data pendaftaran ke database.');
            setOtpLoading(false);
            return;
          }

          if (registerData.code && registerData.qr) {
            setResult({ code: registerData.code, qr: registerData.qr });
          }

          localStorage.setItem('user_nik', form.nik);
        } else {
          const userNik = data.nik || localStorage.getItem('temp_nik');
          if (userNik) localStorage.setItem('user_nik', userNik);
        }

        // Logic sukses verifikasi OTP
        setIsVerified(true);
        setIsOtpModalOpen(false);
        setShowAnimation(true);
        setAnimationType('success');

        setTimeout(() => {
          setShowAnimation(false);
          router.push('/dashboard');
        }, 2500);

      } else {
        setOtpError(data.message || 'Kode OTP salah atau kedaluwarsa.');
      }
    } catch (err) {
      console.error('OTP Verification Error:', err);
      setOtpError('Terjadi kesalahan jaringan.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyUser = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nik: form.nik, whatsapp: form.whatsapp, isVerifying: true })
      });
      const data = await res.json();

      if (data.success) {
        setAnimationType('success');
        setShowAnimation(true);
        localStorage.setItem('user_nik', form.nik);
        setTimeout(() => {
          setShowAnimation(false);
          router.push('/dashboard');
        }, 2000);
      } else {
        setErrorMsg(data.message);
        setAnimationType('error');
        setShowAnimation(true);
        setTimeout(() => setShowAnimation(false), 2500);
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi.');
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
    <main className="min-h-screen bg-slate-950 text-white font-sans relative overflow-hidden flex flex-col justify-between">

      <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] bg-gradient-to-br from-cyan-500/20 via-indigo-500/10 to-transparent rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-gradient-to-tr from-purple-500/10 via-rose-500/10 to-transparent rounded-full blur-[130px] pointer-events-none z-0" />

      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex justify-between items-center border-b border-white/5 relative z-10">
        <div className="flex items-center gap-2">
          <span className="text-xl font-black tracking-tighter bg-gradient-to-r from-cyan-400 via-blue-400 to-white bg-clip-text text-transparent">
            SOWAN<span className="text-white">QR</span>
          </span>
          <span className="px-2 py-0.5 text-[10px] font-bold bg-white/10 rounded-full border border-white/10 tracking-widest">V2.0</span>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setLang(lang === 'id' ? 'en' : 'id')}
            className="px-3 py-1.5 text-xs font-bold border border-white/10 bg-white/5 rounded-xl hover:bg-white/10 transition uppercase tracking-wider text-slate-300"
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
      </header>

      <section className="flex-1 flex items-center justify-center p-6 relative z-10 w-full max-w-lg mx-auto">
        <div className="w-full bg-white/[0.02] border border-white/10 backdrop-blur-2xl rounded-3xl p-8 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">

          {!result ? (
            <div>
              <div className="flex border border-white/5 bg-slate-900 p-1 rounded-2xl mb-6">
                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setIsVerified(false); }}
                  className={`flex-1 py-3 rounded-xl text-xs font-black tracking-wider uppercase transition-all ${authMode === 'login' ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMode('register'); setIsVerified(false); }}
                  className={`flex-1 py-3 rounded-xl text-xs font-black tracking-wider uppercase transition-all ${authMode === 'register' ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
                >
                  {t.tabNew}
                </button>
              </div>

              <div className="text-center mb-6">
                <h3 className="text-sm font-bold tracking-wider text-blue-400 uppercase">
                  {authMode === 'register' ? t.registerT : t.loginT}
                </h3>
              </div>

              {authMode === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-4 animate-in fade-in duration-300">
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">{t.labelEmail}</label>
                    <input
                      type="email"
                      required
                      placeholder="@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full p-3 bg-slate-900 border border-white/10 rounded-xl text-white outline-none focus:border-cyan-500 transition text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">{t.labelWa}</label>
                    <input
                      type="text"
                      required
                      placeholder="0812xxxxxxxx"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      className="w-full p-3 bg-slate-900 border border-white/10 rounded-xl text-white outline-none focus:border-cyan-500 transition text-sm"
                    />
                  </div>

                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <label className="text-xs font-bold text-slate-400 tracking-wider block uppercase">Kirim OTP Lewat</label>
                    <div className="flex gap-3">

                      {/* Label WhatsApp */}
                      <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold cursor-pointer transition ${otpMethod === 'whatsapp'
                        ? 'border-cyan-500/50 bg-cyan-500/[0.04] text-cyan-400' // Gaya saat Terpilih
                        : 'border-white/5 bg-white/[0.02] text-slate-300 hover:bg-white/5' // Gaya Normal
                        }`}>
                        <input
                          type="radio"
                          name="login_otp_channel"
                          value="whatsapp"
                          checked={otpMethod === 'whatsapp'}
                          onChange={() => setOtpMethod('whatsapp')}
                          className="text-cyan-500 focus:ring-0 bg-slate-900 border-white/20"
                        />
                        WhatsApp
                      </label>

                      {/* Label Email */}
                      <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold cursor-pointer transition ${otpMethod === 'email'
                        ? 'border-cyan-500/50 bg-cyan-500/[0.04] text-cyan-400' // Gaya saat Terpilih
                        : 'border-white/5 bg-white/[0.02] text-slate-300 hover:bg-white/5' // Gaya Normal
                        }`}>
                        <input
                          type="radio"
                          name="login_otp_channel"
                          value="email"
                          checked={otpMethod === 'email'}
                          onChange={() => setOtpMethod('email')}
                          className="text-cyan-500 focus:ring-0 bg-slate-900 border-white/20"
                        />
                        Email
                      </label>

                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-indigo-500 text-white font-black rounded-xl hover:opacity-95 transition shadow-lg text-sm uppercase mt-2"
                  >
                    {loading ? t.btnSubmitting : 'Login'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 pt-1 animate-in fade-in duration-300">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-400 uppercase">{t.labelNik}</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      required={authMode === 'register'}
                      value={form.nik || ''}
                      placeholder={t.placeholderNik}
                      onChange={e => setForm({ ...form, nik: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-900/60 border border-white/10 rounded-xl text-white text-sm focus:border-cyan-400 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-400 uppercase">{t.labelNama}</label>
                    <input
                      type="text"
                      required={authMode === 'register'}
                      value={form.nama}
                      placeholder={t.placeholderNama}
                      onChange={e => setForm({ ...form, nama: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-900/60 border border-white/10 rounded-xl text-white text-sm focus:border-cyan-400 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-400 uppercase">{t.labelInstansi}</label>
                    <input
                      type="text"
                      required={authMode === 'register'}
                      value={form.instansi}
                      placeholder={t.placeholderInstansi}
                      onChange={e => setForm({ ...form, instansi: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-900/60 border border-white/10 rounded-xl text-white text-sm focus:border-cyan-400 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-400 uppercase">{t.labelWa}</label>
                    <input
                      type="text"
                      inputMode="tel"
                      required={authMode === 'register'}
                      value={form.whatsapp || ''}
                      placeholder={t.placeholderWa}
                      onChange={e => setForm({ ...form, whatsapp: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-900/60 border border-white/10 rounded-xl text-white text-sm focus:border-cyan-400 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-400 uppercase">{t.labelEmail}</label>
                    <input
                      type="email"
                      required={authMode === 'register'}
                      value={form.email || ''}
                      placeholder="sowarna@email.com"
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-900/60 border border-white/10 rounded-xl text-white text-sm focus:border-cyan-400 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-400 uppercase">{t.labelMenemui}</label>
                    <input
                      type="text"
                      required={authMode === 'register'}
                      value={form.menemui}
                      placeholder={t.placeholderMenemui}
                      onChange={e => setForm({ ...form, menemui: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-900/60 border border-white/10 rounded-xl text-white text-sm focus:border-cyan-400 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-400 uppercase">{t.labelKeperluan}</label>
                    <input
                      type="text"
                      required={authMode === 'register'}
                      value={form.keperluan}
                      placeholder={t.placeholderKeperluan}
                      onChange={e => setForm({ ...form, keperluan: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-900/60 border border-white/10 rounded-xl text-white text-sm focus:border-cyan-400 outline-none"
                    />
                  </div>

                  <div className="space-y-2 text-left">
                    <label className="block text-xs font-bold text-slate-400 uppercase">{t.labelTtd}</label>
                    <div className="border border-white/10 bg-white rounded-2xl overflow-hidden shadow-inner">
                      <SignatureCanvas
                        ref={sigCanvas}
                        penColor="black"
                        canvasProps={{ className: 'w-full h-36 cursor-crosshair' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => sigCanvas.current.clear()}
                      className="text-[10px] font-bold text-slate-400 hover:text-rose-400 transition uppercase tracking-widest flex items-center gap-1"
                    >
                      ✕ {t.btnClearTtd}
                    </button>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <label className="text-xs font-bold text-slate-400 tracking-wider block uppercase">Metode Verifikasi OTP</label>
                    <div className="flex gap-3">
                      <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold cursor-pointer transition ${otpMethod === 'whatsapp'
                        ? 'border-sky-500/50 bg-cyan-500/[0.04] text-sky-400' // Gaya saat Terpilih
                        : 'border-white/5 bg-white/[0.02] text-slate-300 hover:bg-white/5' // Gaya Normal
                        }`}>
                        <input
                          type="radio"
                          name="otp_channel"
                          value="whatsapp"
                          checked={otpMethod === 'whatsapp'}
                          onChange={() => setOtpMethod('whatsapp')}
                          className="text-cyan-500 focus:ring-0 bg-slate-900 border-white/20"
                        />
                        WhatsApp
                      </label>
                      <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold cursor-pointer transition ${otpMethod === 'email'
                        ? 'border-sky-500/50 bg-cyan-500/[0.04] text-sky-400' // Gaya saat Terpilih
                        : 'border-white/5 bg-white/[0.02] text-slate-300 hover:bg-white/5' // Gaya Normal
                        }`}>
                        <input
                          type="radio"
                          name="otp_channel"
                          value="email"
                          checked={otpMethod === 'email'}
                          onChange={() => setOtpMethod('email')}
                          className="text-cyan-500 focus:ring-0 bg-slate-900 border-white/20"
                        />
                        Email
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 hover:opacity-90 active:scale-[0.98] transition-all text-sm font-black tracking-widest uppercase text-white shadow-[0_0_25px_rgba(6,182,212,0.25)] disabled:opacity-50"
                  >
                    {loading ? t.btnSubmitting : t.btnSubmit}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className="text-center space-y-6 py-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-2xl font-bold animate-pulse">
                ✓
              </div>
              <div>
                <h3 className="text-xl font-black uppercase text-white tracking-wide">{t.ticketSuccess}</h3>
                <p className="text-xs text-slate-400 mt-1">{t.ticketDesc}</p>
              </div>

              <div className="relative bg-white p-5 rounded-2xl border-4 border-slate-900 inline-block shadow-2xl">
                <img src={result.qr} alt="SowanQR Code" className="mx-auto w-44 h-44 rounded-lg" />
                <p className="font-mono text-xs font-bold text-slate-500 mt-4 tracking-widest uppercase">{result.code}</p>
              </div>

              <div className="flex flex-col gap-3 max-w-sm mx-auto w-full pt-2">
                <button
                  onClick={downloadQR}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md shadow-emerald-600/10"
                >
                  {t.btnGallery}
                </button>
                <button
                  onClick={handleGoToDashboard}
                  className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-indigo-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg"
                >
                  {t.btnDashboard}
                </button>
              </div>
            </div>
          )}

        </div>
      </section>

      {isOtpModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-6 text-center shadow-2xl transform scale-100 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 flex items-center justify-center mx-auto mb-4 text-white text-lg shadow-lg shadow-cyan-500/20">
              <LockIcon className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-black tracking-wide text-white uppercase">Konfirmasi OTP</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Kami telah mengirimkan 4 digit kode rahasia ke <span className="text-white font-bold">{otpMethod === 'whatsapp' ? 'WhatsApp' : 'Email'}</span> Anda.
            </p>

            <input
              type="number"
              inputMode="numeric"
              maxLength={4}
              required
              placeholder="• • • •"
              value={otpInput}
              onChange={(e) => {
                if (e.target.value.length <= 4) setOtpInput(e.target.value);
              }}
              className="w-full text-center text-2xl font-mono tracking-[1em] pl-[1em] py-3 mt-5 bg-slate-950 border border-white/10 rounded-xl text-cyan-400 outline-none focus:border-cyan-400 transition"
            />

            {otpError && (
              <p className="text-[11px] font-bold text-rose-400 bg-rose-500/10 py-1.5 px-3 rounded-lg mt-3 text-left">
                ⚠ {otpError}
              </p>
            )}

            <div className="mt-5 text-xs font-semibold">
              {countdown > 0 ? (
                <p className="text-slate-500">Kirim ulang kode dalam <span className="text-cyan-400 font-bold">{countdown}s</span></p>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  className="text-cyan-400 hover:text-cyan-300 underline font-bold transition block mx-auto cursor-pointer"
                >
                  Belum terima kode? Kirim Ulang OTP
                </button>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() => { setIsOtpModalOpen(false); setOtpInput(''); setOtpError(''); }}
                className="flex-1 py-3 text-xs font-bold rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 transition uppercase"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmOtp}
                disabled={otpLoading}
                className="flex-1 py-3 text-xs font-black rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 text-white hover:opacity-90 transition uppercase shadow-md disabled:opacity-50"
              >
                {otpLoading ? 'Proses...' : 'Verifikasi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAnimation && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm transition-all duration-300">
          <div className={`p-8 rounded-3xl bg-slate-900 border text-center shadow-2xl max-w-xs w-full mx-4 transform scale-100 transition-all duration-300 animate-in fade-in zoom-in-95 ${animationType === 'success' ? 'border-emerald-500/30 shadow-emerald-500/10' : 'border-rose-500/30 shadow-rose-500/10'
            }`}>
            <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-5 text-4xl font-extrabold animate-bounce ${animationType === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-50/10 text-rose-400'
              }`}>
              {animationType === 'success' ? '✓' : '✕'}
            </div>
            <h3 className={`text-xl font-black tracking-wide ${animationType === 'success' ? 'text-emerald-400' : 'text-rose-400'
              }`}>
              {animationType === 'success' ? 'VERIFIKASI BERHASIL!' : 'PROSES GAGAL!'}
            </h3>
            <p className="text-xs text-slate-400 mt-2 font-medium leading-relaxed">
              {animationType === 'success'
                ? 'Identitas Anda terverifikasi. Mengalihkan...'
                : errorMsg || 'Terjadi kesalahan, silakan periksa kembali data Anda.'
              }
            </p>
          </div>
        </div>
      )}

      <footer className="w-full text-center py-4 text-[10px] font-bold text-slate-600 uppercase tracking-widest relative z-10 border-t border-white/5 bg-slate-950">
        © 2026 SOWANQR SYSTEM • ALL RIGHTS RESERVED Created By Students Of ICB Cinta Niaga
      </footer>
    </main>
  );
}