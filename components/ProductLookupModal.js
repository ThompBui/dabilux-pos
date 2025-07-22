import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

export default function ProductLookupModal({ show, onClose, products, onProductSelect }) {
    const [query, setQuery] = useState('');

    useEffect(() => {
        if (!show) return;
        const handleEsc = (event) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose, show]);

    const activeProducts = useMemo(() => products.filter(p => p.isActive !== false), [products]);

    const filtered = useMemo(() => {
        if (!query) {
            return activeProducts;
        }
        const lowerCaseQuery = query.toLowerCase();
        return activeProducts.filter(p =>
            p.name?.toLowerCase().includes(lowerCaseQuery) ||
            (p.barcode && p.barcode.includes(query))
        );
    }, [query, activeProducts]);

    const handleSelect = (product) => {
        onProductSelect(product);
        onClose();
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl m-4 flex flex-col h-[70vh]" onClick={e => e.stopPropagation()}>
                <div className="p-4 flex justify-between items-center border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <h3 className="text-lg font-bold">Tra cứu sản phẩm</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-4 flex-shrink-0">
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Tìm theo tên hoặc mã vạch..."
                        className="w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                        autoFocus
                    />
                </div>
                <div className="flex-grow overflow-y-auto px-4 pb-4">
                    <div className="space-y-2">
                        {filtered.map(p => (
                            <div key={p.id} onClick={() => handleSelect(p)} className="flex items-center p-3 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-colors">
                                <div className="flex-grow">
                                    <p className="font-semibold">{p.name}</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{p.barcode}</p>
                                </div>
                                <p className="font-bold text-indigo-500">{formatCurrency(p.price)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};