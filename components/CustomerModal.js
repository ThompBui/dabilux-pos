import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function CustomerModal({ show, onClose, customers, onSelectCustomer, onAddNewCustomer }) {
    const [mode, setMode] = useState('search');
    const [query, setQuery] = useState('');
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');

    useEffect(() => {
        if (!show) return;
        const handleEsc = (event) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose, show]);

    const filteredCustomers = customers.filter(c =>
        c.name?.toLowerCase().includes(query.toLowerCase()) || c.phone?.includes(query)
    );

    const handleSelect = (customer) => {
        onSelectCustomer(customer);
        onClose();
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (newName && newPhone) {
            await onAddNewCustomer({ name: newName, phone: newPhone });
            onClose();
            setNewName('');
            setNewPhone('');
            setMode('search');
        }
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
                <div className="p-4 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-bold">Quản lý Khách hàng</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6">
                    <div className="flex border-b border-slate-200 dark:border-slate-700 mb-4">
                        <button onClick={() => setMode('search')} className={`py-2 px-4 text-sm font-medium transition-colors ${mode === 'search' ? 'border-b-2 border-indigo-500 text-indigo-500' : 'text-slate-500'}`}>
                            Tìm
                        </button>
                        <button onClick={() => setMode('add')} className={`py-2 px-4 text-sm font-medium transition-colors ${mode === 'add' ? 'border-b-2 border-indigo-500 text-indigo-500' : 'text-slate-500'}`}>
                            Thêm mới
                        </button>
                    </div>
                    {mode === 'search' ? (
                        <div>
                            <input
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Nhập SĐT hoặc tên..."
                                className="w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-2 mb-4"
                            />
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {filteredCustomers.map(c => (
                                    <div key={c.id} onClick={() => handleSelect(c)} className="p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                                        <p className="font-semibold">{c.name}</p>
                                        <p className="text-sm text-slate-500">{c.phone} - {c.points || 0} điểm</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleAdd} className="space-y-4">
                            <input
                                type="text"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                placeholder="Tên khách hàng"
                                className="w-full bg-slate-100 dark:bg-slate-700 border rounded-lg p-2"
                                required
                            />
                            <input
                                type="tel"
                                value={newPhone}
                                onChange={e => setNewPhone(e.target.value)}
                                placeholder="Số điện thoại"
                                className="w-full bg-slate-100 dark:bg-slate-700 border rounded-lg p-2"
                                required
                            />
                            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg">
                                Thêm và Chọn
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};