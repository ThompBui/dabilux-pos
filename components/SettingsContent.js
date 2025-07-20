import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../firebase';
import { collection, doc, setDoc, deleteDoc, serverTimestamp, onSnapshot, query, orderBy, addDoc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Sidebar from './Sidebar';
import { Store, Plus, Edit, Trash2, Scale, Tag, AlertCircle, X, CheckCircle } from 'lucide-react';

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 w-full max-w-sm">
                <div className="flex items-center space-x-3 mb-4">
                    <AlertCircle size={24} className="text-orange-500" />
                    <h3 className="text-xl font-semibold">{title}</h3>
                </div>
                <p className="text-slate-600 dark:text-slate-300 mb-6">{message}</p>
                <div className="flex justify-end space-x-3">
                    <button onClick={onCancel} className="btn-secondary">Hủy</button>
                    <button onClick={onConfirm} className="btn-danger">Xác nhận</button>
                </div>
            </div>
        </div>
    );
};

const Toast = ({ message, show }) => (
    <div className={`fixed top-5 right-5 bg-green-500 text-white py-3 px-6 rounded-lg shadow-lg flex items-center gap-3 z-50 transition-transform ${show ? 'translate-x-0' : 'translate-x-full'}`}>
        <CheckCircle size={20} /><span>{message}</span>
    </div>
);

const GenericFormModal = ({ isOpen, onClose, item, onSave, title, fields }) => {
    const [formData, setFormData] = useState({});
    useEffect(() => {
        if (isOpen) setFormData(item || {});
    }, [item, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
    const handleSubmit = async (e) => { e.preventDefault(); await onSave(formData); onClose(); };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 w-full max-w-md">
                <div className="flex justify-between items-center mb-4 pb-3 border-b">
                    <h3 className="text-xl font-semibold">{title}</h3>
                    <button onClick={onClose}><X size={24} /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {fields.map(field => (
                        <div key={field.name}>
                            <label htmlFor={field.name} className="block text-sm font-medium mb-1">{field.label}</label>
                            <input type={field.type || 'text'} id={field.name} name={field.name} value={formData[field.name] || ''} onChange={handleChange} className="input-field" required={field.required} />
                        </div>
                    ))}
                    <div className="flex justify-end space-x-3 pt-4">
                        <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
                        <button type="submit" className="btn-primary">Lưu</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default function SettingsContent() {
    const [user, authLoading] = useAuthState(auth);
    const router = useRouter();
    const [storeInfo, setStoreInfo] = useState({ name: '', address: '', phone: '', email: '', logoUrl: '' });
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreviewUrl, setLogoPreviewUrl] = useState('');
    const [toast, setToast] = useState({ show: false, message: '' });
    const [categories, setCategories] = useState([]);
    const [units, setUnits] = useState([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [isConfirmCategoryModalOpen, setIsConfirmCategoryModalOpen] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState(null);
    const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
    const [selectedUnit, setSelectedUnit] = useState(null);
    const [isConfirmUnitModalOpen, setIsConfirmUnitModalOpen] = useState(false);
    const [unitToDelete, setUnitToDelete] = useState(null);
    
    useEffect(() => { if (!authLoading && !user) router.push('/login'); }, [user, authLoading, router]);

    useEffect(() => {
        const unsubscribes = [
            onSnapshot(doc(db, 'settings', 'storeInfo'), (docSnap) => {
                if (docSnap.exists()) {
                    setStoreInfo(docSnap.data());
                    setLogoPreviewUrl(docSnap.data().logoUrl);
                }
            }),
            onSnapshot(query(collection(db, 'categories'), orderBy('name')), (s) => setCategories(s.docs.map(d => ({ id: d.id, ...d.data() })))),
            onSnapshot(query(collection(db, 'units'), orderBy('name')), (s) => setUnits(s.docs.map(d => ({ id: d.id, ...d.data() })))),
        ];
        const timer = setTimeout(() => setDataLoading(false), 2000);
        return () => { unsubscribes.forEach(unsub => unsub()); clearTimeout(timer); };
    }, []);

    const showToast = (message) => {
        setToast({ show: true, message });
        setTimeout(() => setToast({ show: false, message: '' }), 3000);
    };

    const handleLogoFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setLogoFile(file);
            setLogoPreviewUrl(URL.createObjectURL(file));
        }
    };
    
    const handleStoreInfoChange = (e) => setStoreInfo(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSaveStoreInfo = async () => {
        try {
            let finalLogoUrl = storeInfo.logoUrl;
            if (logoFile) {
                const storage = getStorage();
                const logoRef = ref(storage, `store_assets/logo_${Date.now()}`);
                const snapshot = await uploadBytes(logoRef, logoFile); // Sửa lỗi ở đây
                finalLogoUrl = await getDownloadURL(snapshot.ref);
            }
            await setDoc(doc(db, 'settings', 'storeInfo'), { ...storeInfo, logoUrl: finalLogoUrl, lastUpdated: serverTimestamp() }, { merge: true });
            showToast("Lưu thông tin cửa hàng thành công!");
        } catch (error) {
            showToast("Lỗi: Không thể lưu thông tin cửa hàng.");
        }
    };

    const handleAddOrEditGeneric = async (collectionName, data) => {
        try {
            if (data.id) {
                await updateDoc(doc(db, collectionName, data.id), { ...data, updatedAt: serverTimestamp() });
            } else {
                await addDoc(collection(db, collectionName), { ...data, createdAt: serverTimestamp() });
            }
            showToast(`Thao tác thành công!`);
        } catch (error) {
            showToast(`Lỗi: Thao tác thất bại.`);
        }
    };

    const handleDeleteGeneric = async (collectionName, id, setConfirmModalOpen, setItemToDelete) => {
        try {
            await deleteDoc(doc(db, collectionName, id));
            showToast(`Xóa thành công!`);
        } catch (error) {
            showToast(`Lỗi: Không thể xóa.`);
        } finally {
            setConfirmModalOpen(false);
            setItemToDelete(null);
        }
    };

    if (authLoading || dataLoading) {
        return <div className="flex items-center justify-center h-screen"><p>Đang tải cài đặt...</p></div>;
    }
    if (!user) return null;

    return (
        <div className="flex min-h-screen bg-slate-100 dark:bg-slate-900">
            <Sidebar />
            <main className="flex-1 ml-64 p-8">
                <h1 className="text-3xl font-bold mb-8">Cài đặt Hệ thống</h1>
                <section className="card mb-8">
                    <h2 className="card-header"><Store size={24} /> Thông tin Cửa hàng</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
                        {/* Store Info Inputs */}
                        <div>
                            <label className="label">Tên cửa hàng</label>
                            <input type="text" name="name" value={storeInfo.name} onChange={handleStoreInfoChange} className="input-field" />
                        </div>
                        <div>
                            <label className="label">Địa chỉ</label>
                            <input type="text" name="address" value={storeInfo.address} onChange={handleStoreInfoChange} className="input-field" />
                        </div>
                        <div>
                            <label className="label">Số điện thoại</label>
                            <input type="tel" name="phone" value={storeInfo.phone} onChange={handleStoreInfoChange} className="input-field" />
                        </div>
                        <div>
                            <label className="label">Email</label>
                            <input type="email" name="email" value={storeInfo.email} onChange={handleStoreInfoChange} className="input-field" />
                        </div>
                        <div className="md:col-span-2">
                             <label className="label">Logo</label>
                            <div className="flex items-center space-x-4">
                                <img src={logoPreviewUrl || 'https://placehold.co/100x100/e2e8f0/64748b?text=Logo'} alt="Logo Preview" className="w-24 h-24 object-contain rounded-lg border"/>
                                <input type="file" accept="image/*" onChange={handleLogoFileChange} className="input-file" />
                            </div>
                        </div>
                    </div>
                    <div className="p-6 text-right"><button onClick={handleSaveStoreInfo} className="btn-primary">Lưu thông tin</button></div>
                </section>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Category Management */}
                    <section className="card">
                        <h2 className="card-header"><Tag size={22} /> Quản lý Danh mục</h2>
                        <div className="p-4 text-right"><button onClick={() => { setSelectedCategory(null); setIsCategoryModalOpen(true); }} className="btn-primary-sm"><Plus size={16} /> Thêm</button></div>
                        <table className="w-full text-sm"><tbody>
                            {categories.map(cat => (
                                <tr key={cat.id} className="table-row">
                                    <td className="p-2 font-medium">{cat.name}</td>
                                    <td className="p-2 flex justify-end items-center space-x-2">
                                        <button onClick={() => { setSelectedCategory(cat); setIsCategoryModalOpen(true); }} className="btn-icon-edit"><Edit size={16} /></button>
                                        <button onClick={() => { setCategoryToDelete(cat.id); setIsConfirmCategoryModalOpen(true); }} className="btn-icon-delete"><Trash2 size={16} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody></table>
                    </section>
                    {/* Unit Management */}
                     <section className="card">
                        <h2 className="card-header"><Scale size={22} /> Quản lý Đơn vị tính</h2>
                        <div className="p-4 text-right"><button onClick={() => { setSelectedUnit(null); setIsUnitModalOpen(true); }} className="btn-primary-sm"><Plus size={16} /> Thêm</button></div>
                        <table className="w-full text-sm"><tbody>
                            {units.map(unit => (
                                <tr key={unit.id} className="table-row">
                                    <td className="p-2 font-medium">{unit.name}</td>
                                    <td className="p-2 flex justify-end items-center space-x-2">
                                        <button onClick={() => { setSelectedUnit(unit); setIsUnitModalOpen(true); }} className="btn-icon-edit"><Edit size={16} /></button>
                                        <button onClick={() => { setUnitToDelete(unit.id); setIsConfirmUnitModalOpen(true); }} className="btn-icon-delete"><Trash2 size={16} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody></table>
                    </section>
                </div>
            </main>
            <Toast message={toast.message} show={toast.show} />
            <GenericFormModal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} item={selectedCategory} onSave={(data) => handleAddOrEditGeneric('categories', data)} title={selectedCategory ? "Sửa Danh mục" : "Thêm Danh mục"} fields={[{ name: 'name', label: 'Tên danh mục', required: true }]} />
            <ConfirmModal isOpen={isConfirmCategoryModalOpen} title="Xóa Danh mục" message="Bạn chắc chắn muốn xóa?" onConfirm={() => handleDeleteGeneric('categories', categoryToDelete, setIsConfirmCategoryModalOpen, setCategoryToDelete)} onCancel={() => setIsConfirmCategoryModalOpen(false)} />
            <GenericFormModal isOpen={isUnitModalOpen} onClose={() => setIsUnitModalOpen(false)} item={selectedUnit} onSave={(data) => handleAddOrEditGeneric('units', data)} title={selectedUnit ? "Sửa Đơn vị" : "Thêm Đön vị"} fields={[{ name: 'name', label: 'Tên đơn vị', required: true }]} />
            <ConfirmModal isOpen={isConfirmUnitModalOpen} title="Xóa Đơn vị" message="Bạn chắc chắn muốn xóa?" onConfirm={() => handleDeleteGeneric('units', unitToDelete, setIsConfirmUnitModalOpen, setUnitToDelete)} onCancel={() => setIsConfirmUnitModalOpen(false)} />
        </div>
    );
}