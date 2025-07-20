import React, { useEffect, useRef } from 'react';
import { X, Archive } from 'lucide-react';

export default function NotificationPanel({ isOpen, onClose, notifications, onDismiss }) {
    const panelRef = useRef(null);

    useEffect(() => {
        const handleEsc = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        const handleClickOutside = (event) => {
            if (isOpen && panelRef.current && !panelRef.current.contains(event.target)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEsc);
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('keydown', handleEsc);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) {
        return null;
    }

    return (
        <div ref={panelRef} className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-lg border dark:border-slate-700 z-30">
            <div className="flex justify-between items-center p-3 border-b dark:border-slate-700">
                <h3 className="font-semibold text-sm">Thông báo Tồn kho</h3>
                <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
                    <X size={16} />
                </button>
            </div>
            <div className="p-2 max-h-80 overflow-y-auto">
                {notifications.length > 0 ? (
                    notifications.map(product => (
                        <div key={product.id} className="p-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-md">
                            <div>
                                <p className="text-sm font-medium">{product.name}</p>
                                <p className="text-xs text-red-500">Chỉ còn {product.stock} {product.unit || ''}</p>
                            </div>
                            <button onClick={() => onDismiss(product.id)} title="Đã xem, ẩn đi" className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600">
                                <Archive size={16} />
                            </button>
                        </div>
                    ))
                ) : (
                    <p className="text-center text-sm text-slate-400 p-4">Không có thông báo mới.</p>
                )}
            </div>
        </div>
    );
};