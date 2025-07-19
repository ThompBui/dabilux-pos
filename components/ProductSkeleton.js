import React from 'react';

export default function ProductSkeleton() {
    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg p-3 flex flex-col items-center text-center shadow-md animate-pulse">
            <div className="w-20 h-20 bg-slate-200 dark:bg-slate-700 rounded-md mb-2"></div>
            <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded mb-2"></div>
            <div className="h-6 w-1/2 bg-slate-200 dark:bg-slate-700 rounded"></div>
        </div>
    );
};