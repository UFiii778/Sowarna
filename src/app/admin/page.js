'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminDashboard() {
    const [tamu, setTamu] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ nama: '', instansi: '', whatsapp: '' });

    // 1. Fungsi Mengambil Data dari Supabase
    const fetchTamu = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('tamu')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("DETAIL ERROR DARI SUPABASE:", error);
        } else {
            console.log("DATA BERHASIL DIAMBIL:", data);
            setTamu(data);
        }
        setLoading(false);
    };

    // 2. Setup Real-time Listener (Otomatis Update tanpa Refresh)
    useEffect(() => {
        fetchTamu();

        const channel = supabase
            .channel('realtime_tamu')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'tamu' },
                () => {
                    fetchTamu();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleDelete = async (id) => {
        if (confirm('Apakah Anda yakin ingin menghapus data tamu ini?')) {
            const { error } = await supabase.from('tamu').delete().eq('id', id);
            if (error) alert('Gagal menghapus data');
        }
    };

    const startEdit = (item) => {
        setEditingId(item.id);
        setEditForm({ nama: item.nama, instansi: item.instansi, whatsapp: item.whatsapp });
    };

    const handleUpdate = async (id) => {
        const { error } = await supabase
            .from('tamu')
            .update(editForm)
            .eq('id', id);

        if (!error) {
            setEditingId(null);
        } else {
            alert('Gagal memperbarui data');
        }
    };

    useEffect(() => {
        console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
    }, []);

    const totalTamu = tamu.length;

    return (
        <main className="min-h-screen bg-slate-50 p-4 sm:p-8 text-slate-800">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header Dashboard */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div>
                        <h1 className="text-2xl font-bold text-indigo-600">Dashboard Admin</h1>
                        <p className="text-sm text-slate-500">Kelola data pengunjung SowanQR secara langsung.</p>
                    </div>

                    {/* Widget Counter Real-time */}
                    <div className="bg-indigo-50 border border-indigo-100 px-6 py-3 rounded-2xl flex items-center gap-4 shadow-sm shadow-indigo-100">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </span>
                        <div>
                            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Total Tamu (Real-time)</p>
                            <p className="text-3xl font-extrabold text-slate-900">{totalTamu}</p>
                        </div>
                    </div>
                </div>

                {/* Tabel Data Tamu */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                    <th className="px-6 py-4">Nama</th>
                                    <th className="px-6 py-4">Instansi / Sekolah</th>
                                    <th className="px-6 py-4">WhatsApp</th>
                                    <th className="px-6 py-4 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {loading ? (
                                    <tr>
                                        <td colSpan="4" className="text-center py-8 text-slate-400">Memuat data tamu...</td>
                                    </tr>
                                ) : tamu.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="text-center py-8 text-slate-400">Belum ada tamu yang mendaftar.</td>
                                    </tr>
                                ) : (
                                    tamu.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                            {editingId === item.id ? (
                                                <>
                                                    {/* Mode Edit Inline */}
                                                    <td className="px-6 py-3">
                                                        <input type="text" value={editForm.nama}
                                                            className="w-full px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                                            onChange={(e) => setEditForm({ ...editForm, nama: e.target.value })} />
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <input type="text" value={editForm.instansi}
                                                            className="w-full px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                                            onChange={(e) => setEditForm({ ...editForm, instansi: e.target.value })} />
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <input type="text" value={editForm.whatsapp}
                                                            className="w-full px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                                            onChange={(e) => setEditForm({ ...editForm, whatsapp: e.target.value })} />
                                                    </td>
                                                    <td className="px-6 py-3 text-right space-x-2">
                                                        <button onClick={() => handleUpdate(item.id)}
                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1.5 rounded-lg transition">
                                                            Simpan
                                                        </button>
                                                        <button onClick={() => setEditingId(null)}
                                                            className="bg-slate-200 hover:bg-slate-300 text-slate-600 font-medium px-3 py-1.5 rounded-lg transition">
                                                            Batal
                                                        </button>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    {/* Mode Tampilan Biasa */}
                                                    <td className="px-6 py-4 font-semibold text-slate-700">{item.nama}</td>
                                                    <td className="px-6 py-4 text-slate-600">{item.instansi}</td>
                                                    <td className="px-6 py-4 font-mono text-slate-500">{item.whatsapp}</td>
                                                    <td className="px-6 py-4 text-right space-x-2">
                                                        <button onClick={() => startEdit(item)}
                                                            className="text-indigo-600 hover:text-indigo-900 font-medium transition">
                                                            Edit
                                                        </button>
                                                        <span className="text-slate-300">|</span>
                                                        <button onClick={() => handleDelete(item.id)}
                                                            className="text-rose-600 hover:text-rose-900 font-medium transition">
                                                            Hapus
                                                        </button>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </main>
    );
}