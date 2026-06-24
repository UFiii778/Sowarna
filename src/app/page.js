'use client';
import SignatureCanvas from 'react-signature-canvas';
import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { dictionary } from '@/constants/languages';
import { AlertCircle, Bot, LockIcon, Mail, Moon, Sun, UserCheck, UserCheck2 } from 'lucide-react';
import Beams from '@/components/ui/beams';
import Stepper, { Step } from '@/components/ui/stepper';

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

  // Ketik ini di baris atas state page.js Anda
  const [activeStep, setActiveStep] = useState(1);
  const [errorSteps, setErrorSteps] = useState([]);

  const [hasSigned, setHasSigned] = useState(false);

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
    menemui: '',
    signature: '',
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

  const handleRegisterSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
      setErrorMsg('Silakan bubuhkan tanda tangan Anda terlebih dahulu.');
      setAnimationType('error');
      setShowAnimation(true);
      setErrorSteps([4]);
      return;
    }

    const ttdBase64 = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsapp: form.whatsapp,
          email: form.email,
          method: otpMethod,
          purpose: 'register'
        })
      });

      const data = await res.json();

      if (data.success) {
        setForm(prev => ({ ...prev, signature: ttdBase64 }));

        setActiveTargetWa(form.whatsapp);
        setActiveTargetEmail(form.email);
        setIsOtpModalOpen(true);
        setCountdown(60);
      } else {
        setErrorMsg(data.message || 'Gagal mengirimkan kode verifikasi OTP.');
        setAnimationType('error');
        setShowAnimation(true);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Terjadi kesalahan jaringan.');
      setAnimationType('error');
      setShowAnimation(true);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }

    if (loading) return;

    const nomorWaKirim = whatsapp;
    const emailKirim = email;

    if (otpMethod === 'whatsapp' && !nomorWaKirim) {
      alert('Silakan masukkan nomor WhatsApp Anda terlebih dahulu!');
      return;
    }
    if (otpMethod === 'email' && !emailKirim) {
      alert('Silakan masukkan alamat Email Anda terlebih dahulu!');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    localStorage.setItem('temp_nik', form.nik);

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsapp: nomorWaKirim,
          email: emailKirim,
          method: otpMethod,
          purpose: 'login'
        })
      });

      const data = await res.json();

      if (data.success) {
        setActiveTargetWa(nomorWaKirim);
        setActiveTargetEmail(emailKirim);
        setIsOtpModalOpen(true);
        setCountdown(60);
        setOtpError('');
      } else {
        const backendMessage = data.message || 'Gagal mengirimkan kode verifikasi OTP.';
        setErrorMsg(backendMessage);
        setAnimationType('error');
        setShowAnimation(true);
      }
    } catch (err) {
      console.error('Login OTP Error:', err);
      alert('Terjadi kesalahan jaringan saat mengirim OTP.');
    } finally {
      setLoading(false); 
    }
  };

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

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    setActiveTargetWa(whatsapp);
    setActiveTargetEmail(email);

    try {
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

      const otpRes = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp, email, method: otpMethod }),
      });

      const otpData = await otpRes.json();

      if (otpData.success) {
        const userNik = loginData.nik || loginData.profil?.nik;

        if (userNik) {
          localStorage.setItem('temp_nik', userNik);
        } else {
          console.error("Gagal menyimpan temp_nik: NIK tidak ditemukan di respon API login.");
        }

        setIsOtpModalOpen(true);
        setCountdown(60);
      } else {
        alert('Gagal mengirimkan kode OTP: ' + otpData.message);
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
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsapp: activeTargetWa,
          email: activeTargetEmail,
          method: otpMethod,
          otpInput: otpInput
        })
      });

      const data = await res.json();

      if (data.success) {
        if (authMode === 'register') {
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
              signature: form.signature
            })
          });

          const registerData = await registerRes.json();

          if (!registerData.success) {
            setOtpError(registerData.message || 'Gagal menyimpan data pendaftaran ke database.');
            setOtpLoading(false);
            return;
          }

          if (registerData.code && registerData.qr) {
            setResult({ code: registerData.code, qr: registerData.qr });
          }

          localStorage.setItem('user_nik', form.nik);
        } else {
 
          const userNik = data.nik;

          if (userNik && userNik !== 'undefined') {
            localStorage.setItem('user_nik', userNik);
            localStorage.setItem('nik', userNik); 
          } else {
            console.error("Gagal mendapatkan NIK dari API verify-otp");
          }
        }

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

  const isStepValid = (stepNumber) => {
    if (stepNumber === 1) {
      return form.nik?.trim() !== '' && form.nama?.trim() !== '' && form.instansi?.trim() !== '';
    }
    if (stepNumber === 2) {
      return form.whatsapp?.trim() !== '' && form.email?.trim() !== '';
    }
    if (stepNumber === 3) {
      return form.menemui?.trim() !== '' && form.keperluan?.trim() !== '';
    }
    return true;
  };

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-slate-950 text-white font-sans relative overflow-hidden flex flex-col justify-between transition-colors duration-300 dark">

      <div className="fixed inset-0 w-screen h-screen z-0 pointer-events-none opacity-100 transition-opacity">
        <Beams className="w-full h-full" />
      </div>

      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex justify-between items-center border-b border-white/5 relative z-10">
        <div className="flex items-center gap-2">
          <span className="text-xl font-black tracking-tighter bg-gradient-to-r from-cyan-400 via-blue-400 to-white bg-clip-text text-transparent">
            SOWAN<span className="text-white">QR</span>
          </span>
          <span className="px-2 py-0.5 text-[10px] font-bold bg-white/10 rounded-full border border-white/10 tracking-widest text-white">V2.0</span>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setLang(lang === 'id' ? 'en' : 'id')}
            className="px-3 py-1.5 text-xs font-bold border rounded-xl transition uppercase tracking-wider border-white/10 bg-white/5 hover:bg-white/10 text-slate-300"
          >
            {lang === 'id' ? 'EN' : 'ID'}
          </button>
        </div>
      </header>

      <section className="flex-1 flex items-center justify-center p-6 relative z-10 w-full max-w-lg mx-auto">
        <div className="w-full bg-slate-900/40 border border-white/10 backdrop-blur-2xl rounded-3xl p-8 shadow-[0_24px_80px_rgba(0,0,0,0.6)] transition-all duration-300">

          {!result ? (
            <div>
              <div className="flex border border-white/5 bg-slate-900 p-1 rounded-2xl mb-6 shadow-inner">
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
                      className="w-full p-3 bg-slate-900 border border-white/10 rounded-xl text-white outline-none focus:border-cyan-400 transition text-sm shadow-inner"
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
                      className="w-full p-3 bg-slate-900 border border-white/10 rounded-xl text-white outline-none focus:border-cyan-400 transition text-sm shadow-inner"
                    />
                  </div>

                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <label className="text-xs font-bold text-slate-400 tracking-wider block uppercase">{t.metodeOTP}</label>
                    <div className="flex gap-3">
                      <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold cursor-pointer transition ${otpMethod === 'whatsapp'
                        ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400'
                        : 'border-white/5 bg-white/[0.02] text-slate-300 hover:bg-white/5'
                        }`}>
                        <input
                          type="radio"
                          name="login_otp_channel"
                          value="whatsapp"
                          checked={otpMethod === 'whatsapp'}
                          onChange={() => setOtpMethod('whatsapp')}
                          className="hidden"
                        />
                        <Bot className='w-4 h-4'></Bot>
                        WhatsApp
                      </label>

                      <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold cursor-pointer transition ${otpMethod === 'email'
                        ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400'
                        : 'border-white/5 bg-white/[0.02] text-slate-300 hover:bg-white/5'
                        }`}>
                        <input
                          type="radio"
                          name="login_otp_channel"
                          value="email"
                          checked={otpMethod === 'email'}
                          onChange={() => setOtpMethod('email')}
                          className="hidden"
                        />
                        <Mail className='w-4 h-4'></Mail>
                        Email
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    onClick={handleLoginSubmit}
                    className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-indigo-500 text-white font-black rounded-xl hover:opacity-95 transition shadow-lg text-sm uppercase mt-2 active:scale-[0.99]"
                  >
                    {loading ? t.btnSubmitting : 'Login'}
                  </button>
                </form>
              ) : (
                <div className="w-full animate-in fade-in duration-300 text-left block relative">
                  <Stepper
                    activeStep={activeStep}
                    initialStep={1}
                    disableStepIndicators={true} 
                    errorSteps={errorSteps}
                    onStepChange={(step) => {
                      setActiveStep(step);
                      setErrorSteps(prev => prev.filter(s => s !== step));
                    }}
                    onFinalStepCompleted={handleRegisterSubmit}
                    backButtonText="Sebelumnya"
                    nextButtonText="Berikutnya"
                    nextButtonProps={{
                      disabled: !isStepValid(activeStep),
                      className: `duration-350 flex items-center justify-center rounded-xl py-2.5 px-5 text-xs font-black tracking-widest uppercase text-white transition ${!isStepValid(activeStep)
                        ? 'opacity-40 bg-slate-500 cursor-not-allowed pointer-events-none'
                        : 'bg-gradient-to-r from-cyan-500 to-indigo-500 hover:opacity-90 active:scale-95'
                        }`
                    }}
                  >
                    {/* 1️⃣ STEP 1: IDENTITAS UTAMA */}
                    <Step>
                      <div className="w-full space-y-4 py-2 block relative">
                        <div className="text-center mb-2">
                          <h4 className="text-[11px] font-black tracking-widest text-cyan-500 uppercase">Langkah 1: Identitas Tamu</h4>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-400 block mb-1">{t.labelNik}</label>
                          <input
                            type="text"
                            required
                            placeholder={t.placeholderNik}
                            value={form.nik}
                            onChange={(e) => setForm({ ...form, nik: e.target.value })}
                            className="w-full p-3 bg-slate-900 border border-white/10 rounded-xl text-white outline-none focus:border-cyan-400 transition text-sm shadow-inner"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-400 block mb-1">{t.labelNama}</label>
                          <input
                            type="text"
                            required
                            placeholder={t.placeholderNama}
                            value={form.nama}
                            onChange={(e) => setForm({ ...form, nama: e.target.value })}
                            className="w-full p-3 bg-slate-900 border border-white/10 rounded-xl text-white outline-none focus:border-cyan-400 transition text-sm shadow-inner"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-400 block mb-1">{t.labelInstansi}</label>
                          <input
                            type="text"
                            required
                            placeholder={t.placeholderInstansi}
                            value={form.instansi}
                            onChange={(e) => setForm({ ...form, instansi: e.target.value })}
                            className="w-full p-3 bg-slate-900 border border-white/10 rounded-xl text-white outline-none focus:border-cyan-400 transition text-sm shadow-inner"
                          />
                        </div>
                      </div>
                    </Step>

                    {/* 2️⃣ STEP 2: KONTAK & KANAL VERIFIKASI */}
                    <Step>
                      <div className="w-full space-y-4 py-2 block relative">
                        <div className="text-center mb-2">
                          <h4 className="text-[11px] font-black tracking-widest text-cyan-500 uppercase">Langkah 2: Informasi Kontak</h4>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-400 block mb-1">Nomor WhatsApp</label>
                          <input
                            type="text"
                            required
                            placeholder="08xxxxxxxxxx"
                            value={form.whatsapp}
                            onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                            className="w-full p-3 bg-slate-900 border border-white/10 rounded-xl text-white outline-none focus:border-cyan-400 transition text-sm shadow-inner"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-400 block mb-1">Alamat Email</label>
                          <input
                            type="email"
                            required
                            placeholder="nama@email.com"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            className="w-full p-3 bg-slate-900 border border-white/10 rounded-xl text-white outline-none focus:border-cyan-400 transition text-sm shadow-inner"
                          />
                        </div>

                        <div className="space-y-2 pt-2 border-t border-white/5">
                          <label className="text-xs font-bold text-slate-400 tracking-wider block uppercase">Kanal Pengiriman OTP</label>
                          <div className="flex gap-3">
                            <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold cursor-pointer transition ${otpMethod === 'whatsapp'
                              ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400'
                              : 'border-white/5 bg-white/[0.02] text-slate-300 hover:bg-white/5'
                              }`}>
                              <input
                                type="radio"
                                name="register_otp_channel"
                                value="whatsapp"
                                checked={otpMethod === 'whatsapp'}
                                onChange={() => setOtpMethod('whatsapp')}
                                className="hidden"
                              />
                              <Bot className='w-4 h-4' />
                              WhatsApp
                            </label>

                            <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold cursor-pointer transition ${otpMethod === 'email'
                              ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400'
                              : 'border-white/5 bg-white/[0.02] text-slate-300 hover:bg-white/5'
                              }`}>
                              <input
                                type="radio"
                                name="register_otp_channel"
                                value="email"
                                checked={otpMethod === 'email'}
                                onChange={() => setOtpMethod('email')}
                                className="hidden"
                              />
                              <Mail className='w-4 h-4' />
                              Email
                            </label>
                          </div>
                        </div>
                      </div>
                    </Step>

                    {/* 3️⃣ STEP 3: TUJUAN KUNJUNGAN */}
                    <Step>
                      <div className="w-full space-y-4 py-2 block relative">
                        <div className="text-center mb-2">
                          <h4 className="text-[11px] font-black tracking-widest text-cyan-500 uppercase">Langkah 3: Detail Kunjungan</h4>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-400 block mb-1">Pegawai yang Menemui</label>
                          <input
                            type="text"
                            required
                            placeholder="Nama pejabat / divisi tujuan"
                            value={form.menemui}
                            onChange={(e) => setForm({ ...form, menemui: e.target.value })}
                            className="w-full p-3 bg-slate-900 border border-white/10 rounded-xl text-white outline-none focus:border-cyan-400 transition text-sm shadow-inner"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-400 block mb-1">Keperluan / Tujuan</label>
                          <textarea
                            required
                            rows={3}
                            placeholder="Tuliskan alasan kunjungan Anda secara singkat"
                            value={form.keperluan}
                            onChange={(e) => setForm({ ...form, keperluan: e.target.value })}
                            className="w-full p-3 bg-slate-900 border border-white/10 rounded-xl text-white outline-none focus:border-cyan-400 transition text-sm shadow-inner resize-none"
                          />
                        </div>
                      </div>
                    </Step>

                    {/* 4️⃣ STEP 4: TANDA TANGAN DIGITAL & VALIDASI TIKET */}
                    <Step>
                      <div className="w-full space-y-4 py-2 block relative">
                        <div className="text-center mb-2">
                          <h4 className="text-[11px] font-black tracking-widest text-slate-400 uppercase">Langkah 4: Konfirmasi Akhir</h4>
                        </div>

                        {/* 📋 RINGKASAN DATA USER (SUMMARY CARD) */}
                        <div className="space-y-2.5 bg-slate-900/40 border border-white/5 rounded-2xl p-3.5 shadow-inner text-left text-xs">
                          <h5 className="text-[10px] font-black tracking-widest text-cyan-500 uppercase mb-1 flex items-center gap-1">
                            📝 Periksa Kembali Data Anda
                          </h5>

                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <div>
                              <p className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Identitas Tamu</p>
                              <p className="font-semibold text-slate-200">{form.nama || '-'} ({form.instansi || '-'})</p>
                              <p className="text-slate-500 text-[11px] font-mono">NIK: {form.nik || '-'}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setActiveStep(1)}
                              className="text-[10px] font-black text-cyan-500 hover:text-indigo-500 uppercase tracking-wider px-2 py-1 bg-cyan-500/10 rounded-lg transition"
                            >
                              Edit
                            </button>
                          </div>

                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <div>
                              <p className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Kontak & Kanal OTP</p>
                              <p className="font-semibold text-slate-200">WA: {form.whatsapp || '-'} | Email: {form.email || '-'}</p>
                              <p className="text-[10px] text-cyan-500 font-bold uppercase tracking-wide">Metode: Verifikasi via {otpMethod}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setActiveStep(2)}
                              className="text-[10px] font-black text-cyan-500 hover:text-indigo-500 uppercase tracking-wider px-2 py-1 bg-cyan-500/10 rounded-lg transition"
                            >
                              Edit
                            </button>
                          </div>

                          <div className="flex items-center justify-between pb-1">
                            <div>
                              <p className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Tujuan Kunjungan</p>
                              <p className="font-semibold text-slate-200">Menemui: {form.menemui || '-'} <span className="text-slate-400 font-normal">| Keperluan:</span> {form.keperluan || '-'}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setActiveStep(3)}
                              className="text-[10px] font-black text-cyan-500 hover:text-indigo-500 uppercase tracking-wider px-2 py-1 bg-cyan-500/10 rounded-lg transition"
                            >
                              Edit
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2 text-left">
                          <label className="block text-xs font-bold text-slate-400 uppercase">{t.labelTtd}</label>
                          <div className="border border-white/10 bg-white rounded-2xl overflow-hidden shadow-inner">
                            <SignatureCanvas
                              ref={sigCanvas}
                              penColor="black"
                              canvasProps={{ className: 'w-full h-28 cursor-crosshair' }}
                              onEnd={() => setHasSigned(true)}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              sigCanvas.current.clear();
                              setHasSigned(false);
                            }}
                            className="text-[10px] font-bold text-slate-400 hover:text-rose-500 transition uppercase tracking-widest flex items-center gap-1"
                          >
                            ✕ {t.btnClearTtd}
                          </button>
                        </div>
                      </div>
                    </Step>
                  </Stepper>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center space-y-6 py-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-2xl font-bold animate-pulse">
                <UserCheck className='w-10 h-5'></UserCheck>
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

            <h3 className="text-lg font-black tracking-wide uppercase">{t.konfirmasiotp}</h3>
            <p className="text-xs mt-1 leading-relaxed text-slate-400">
              {t.digitotp} <span className="font-bold text-white">{otpMethod === 'whatsapp' ? 'WhatsApp' : 'Email'}</span>
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
              className="w-full text-center text-2xl font-mono tracking-[1em] pl-[1em] py-3 mt-5 bg-slate-950 border border-white/10 rounded-xl text-cyan-400 outline-none focus:border-cyan-500 transition"
            />

            {otpError && (
              <p className="text-[11px] font-bold text-rose-400 bg-rose-500/10 py-1.5 px-3 rounded-lg mt-3 text-left">
                ⚠ {otpError}
              </p>
            )}

            <div className="mt-5 text-xs font-semibold">
              {countdown > 0 ? (
                <p className="text-slate-500">{t.resendotp} <span className="text-cyan-400 font-bold">{countdown}s</span></p>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  className="text-cyan-400 hover:opacity-80 underline font-bold transition block mx-auto cursor-pointer"
                >
                  {t.cannototp}
                </button>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() => { setIsOtpModalOpen(false); setOtpInput(''); setOtpError(''); }}
                className="flex-1 py-3 text-xs font-bold rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 transition uppercase"
              >
                {t.cancel}
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
            <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-5 text-4xl font-extrabold ${animationType === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-50/10 text-rose-400'
              }`}>
              {animationType === 'success' ? <UserCheck2 className='w-10 h-10'></UserCheck2> : <AlertCircle className='w-10 h-10'></AlertCircle>}
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

            {animationType === 'error' && (
              <div className="flex gap-2 mt-5">
                <button
                  type="button"
                  onClick={() => {
                    setShowAnimation(false);
                    setActiveStep(2);
                  }}
                  className="flex-1 py-2.5 bg-white/10 text-slate-200 text-xs font-black rounded-xl uppercase tracking-widest transition hover:bg-slate-200"
                >
                  Kembali
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      <footer className="w-full text-center py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest relative z-10 border-t border-white/5 bg-slate-950/40 backdrop-blur-md transition-all duration-300">
        © 2026 SOWANQR SYSTEM • ALL RIGHTS RESERVED Created By Students Of ICB Cinta Niaga
      </footer>
    </main>
  );
}