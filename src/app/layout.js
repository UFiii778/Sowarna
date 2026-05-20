import './globals.css';

export const metadata = {
  title: 'SowanrnaQR - Buku Tamu Digital',
  description: 'Aplikasi Buku Tamu Berbasis QR Code',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className="bg-slate-50 m-0 p-0">
        <div className="min-h-screen bg-slate-50">
          {children}
        </div>
      </body>
    </html>
  );
}