import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function CalculatorModal({ show, onClose }) {
    const [display, setDisplay] = useState('0');

    useEffect(() => {
        if (!show) return;
        const handleEsc = (event) => { if (event.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose, show]);

    const handleInput = (value) => {
        if (display === '0' || display === 'Error') {
            setDisplay(value);
        } else {
            setDisplay(display + value);
        }
    };

    const handleClear = () => setDisplay('0');

    const handleCalculate = () => {
        try {
            // Using new Function() is a simple way to evaluate a string, but be aware of security implications if the string can be user-manipulated.
            // For a calculator, where input is controlled, it's generally fine.
            const result = new Function('return ' + display.replace(/[^-()\d/*+.]/g, ''))();
            setDisplay(String(result));
        } catch {
            setDisplay('Error');
        }
    };

    const buttons = ['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '=', '+'];

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-xs m-4" onClick={e => e.stopPropagation()}>
                <div className="p-4 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-bold">Máy tính</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"><X size={20} /></button>
                </div>
                <div className="p-4">
                    <div className="bg-slate-100 dark:bg-slate-900 text-right text-3xl font-mono p-4 rounded-lg mb-4 break-all">{display}</div>
                    <div className="grid grid-cols-4 gap-2">
                        <button onClick={handleClear} className="col-span-4 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-lg">C</button>
                        {buttons.map(btn => (
                            <button
                                key={btn}
                                onClick={() => (btn === '=') ? handleCalculate() : handleInput(btn)}
                                className={`font-bold text-xl py-3 rounded-lg text-white ${btn === '=' ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-slate-500 dark:bg-slate-600 hover:bg-slate-600 dark:hover:bg-slate-700'}`}
                            >
                                {btn}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};