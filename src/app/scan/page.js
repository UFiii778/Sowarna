'use client';
import { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function ScanPage() {
  const [scanResult, setScanResult] = useState(null);
  const [status, setStatus] = useState({ success: null, message: '' });

  useEffect(() => {
    const scanner = new Html5QrcodeScanner('reader', {
      fps: 10,
      qrbox: { width: 250, height: 250 },
    });

    scanner.render(onScanSuccess, onScanFailure);

    async function onScanSuccess(resultText) {
      scanner.clear(); // Hentikan scan sementara proses validasi
      setScanResult(resultText);

      // Kirim hasil scan ke API backend
      try {
        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kodeBooking: resultText })
        });
        const data = await res.json();
        setStatus({ success: data.success, message: data.message });
      } catch (err) {
        setStatus({ success: false, message: 'Gagal terhubung ke server.' });
      }
    }

    function onScanFailure(err) {
      // Abaikan error nyari QR berulang-ulang di frame kamera
    }
      

    return () => scanner.clear();
  }, []);

  return (
    <main className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700">
        <h1 className="text-2xl font-bold text-center mb-6 text-indigo-400">Scanner Penjaga Gerbang</h1>
        
        {!scanResult ? (
          <div id="reader" className="overflow-hidden rounded-xl bg-slate-950"></div>
        ) : (
          <div className="text-center space-y-6 py-4">
            <div className={`p-4 rounded-xl font-bold text-lg ${status.success ? 'bg-green-900/50 text-green-300 border border-green-500' : 'bg-red-900/50 text-red-300 border border-red-500'}`}>
              {status.message || 'Memproses data...'}
            </div>
            <button onClick={() => window.location.reload()} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition">
              Scan QR Selanjutnya
            </button>
          </div>
        )}
      </div>
    </main>
  );
}