// components/SettingsContent.js
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../firebase';
import { collection, doc, setDoc, deleteDoc, serverTimestamp, onSnapshot, query, orderBy, addDoc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Sidebar from './Sidebar'; // Đã điều chỉnh đường dẫn
import { Store, Plus, Edit, Trash2, Scale, Tag, AlertCircle, X, CheckCircle } from 'lucide-react';

// --- SUB-COMPONENTS ---
const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 w-full max-w-sm">
                <div className="flex items-center space-x-3 mb-4">
                    <AlertCircle size={24} className="text-orange-500" />
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-slate-100">{title}</h3>
                </div>
                <p className="text-gray-700 dark:text-slate-300 mb-6">{message}</p>
                <div className="flex justify-end space-x-3">
                    <button onClick={onCancel} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors duration-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">Hủy</button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200">Xác nhận</button>
                </div>
            </div>
        </div>
    );
};

const Toast = ({ message, show }) => (
    <div className={`fixed top-5 right-5 bg-green-500 text-white py-3 px-6 rounded-lg shadow-lg flex items-center gap-3 transform transition-transform duration-300 z-50 ${show ? 'translate-x-0' : 'translate-x-[150%]'}`}>
        <CheckCircle size={20} />
        <span className="font-semibold">{message}</span>
    </div>
);

const GenericFormModal = ({ isOpen, onClose, item, onSave, title, fields }) => {
    const [formData, setFormData] = useState({});
    useEffect(() => {
        if (isOpen) {
            setFormData(item || {});
        }
    }, [item, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e) => { const { name, value } = e.target; setFormData({ ...formData, [name]: value }); };
    const handleSubmit = async (e) => { e.preventDefault(); await onSave(formData); onClose(); };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 w-full max-w-md">
                <div className="flex justify-between items-center mb-4 border-b pb-3 border-slate-200 dark:border-slate-700">
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-slate-100">{title}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"><X size={24} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    {fields.map(field => (
                        <div className="mb-4" key={field.name}>
                            <label htmlFor={field.name} className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{field.label}</label>
                            <input
                                type={field.type || 'text'}
                                id={field.name}
                                name={field.name}
                                value={formData[field.name] || ''}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                                required={field.required}
                            />
                        </div>
                    ))}
                    <div className="flex justify-end space-x-3 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors">Hủy</button>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Lưu</button>
                    </div>
                </form>
            </div>
        </div>
    );
};


// --- COMPONENT CHÍNH ---
export default function SettingsContent() { // Đã đổi tên hàm
    const [user, authLoading] = useAuthState(auth);
    const router = useRouter();

    const [storeInfo, setStoreInfo] = useState({ name: '', address: '', phone: '', email: '', logoUrl: '' });
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreviewUrl, setLogoPreviewUrl] = useState('');
    const [toast, setToast] = useState({ show: false, message: '' });
    const [categories, setCategories] = useState([]);
    const [units, setUnits] = useState([]);
    const [dataLoading, setDataLoading] = useState(true); // Đổi tên từ 'loadingData'
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [isConfirmCategoryModalOpen, setIsConfirmCategoryModalOpen] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState(null);
    const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
    const [selectedUnit, setSelectedUnit] = useState(null);
    const [isConfirmUnitModalOpen, setIsConfirmUnitModalOpen] = useState(false);
    const [unitToDelete, setUnitToDelete] = useState(null);

    // Logic xác thực
    useEffect(() => {
        if (!authLoading) {
            if (!user) {
                if (router.pathname !== '/login') {
                    console.log("AUTH: Chuyển hướng đến /login");
                    router.push('/login');
                }
            } else {
                console.log("AUTH: Người dùng đã đăng nhập:", user.email);
            }
        } else {
            console.log("AUTH: Đang tải trạng thái xác thực...");
        }
    }, [user, authLoading, router]);

    // Lắng nghe dữ liệu
    useEffect(() => {
        console.log("DATA: Bắt đầu lắng nghe Settings data...");
        const unsubscribes = [
            onSnapshot(doc(db, 'settings', 'storeInfo'), (docSnap) => {
                if (docSnap.exists()) {
                    setStoreInfo(docSnap.data());
                    setLogoPreviewUrl(docSnap.data().logoUrl);
                }
                console.log("DATA: StoreInfo tải.");
            }),
            onSnapshot(query(collection(db, 'categories'), orderBy('name')), (snapshot) => {
                setCategories(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
                console.log("DATA: Categories tải:", snapshot.docs.length);
            }),
            onSnapshot(query(collection(db, 'units'), orderBy('name')), (snapshot) => {
                setUnits(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
                console.log("DATA: Units tải:", snapshot.docs.length);
            }),
        ];
        const timer = setTimeout(() => {
            setDataLoading(false); // Đổi tên từ setLoadingData
            console.log("DATA: dataLoading Settings chuyển FALSE.");
        }, 2000); // 2 giây để tải dữ liệu ban đầu
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

    const handleStoreInfoChange = (e) => {
        const { name, value } = e.target;
        setStoreInfo(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveStoreInfo = async () => {
        try {
            let finalLogoUrl = storeInfo.logoUrl;
            if (logoFile) {
                const storage = getStorage();
                const logoRef = ref(storage, `store_assets/logo_${Date.now()}`);
                const snapshot = await uploadBytes(logoRef, logoRef); // Lỗi ở đây: logoRef thay vì logoFile
                finalLogoUrl = await getDownloadURL(snapshot.ref);
            }
            const docRef = doc(db, 'settings', 'storeInfo');
            await setDoc(docRef, { ...storeInfo, logoUrl: finalLogoUrl, lastUpdated: serverTimestamp() }, { merge: true });
            showToast("Lưu thông tin cửa hàng thành công!");
        } catch (error) {
            console.error("Lỗi khi lưu thông tin cửa hàng:", error);
            showToast("Lỗi: Không thể lưu thông tin cửa hàng.");
        }
    };

    const handleAddOrEditGeneric = async (collectionName, data) => {
        try {
            if (data.id) { // Edit
                const { id, ...rest } = data;
                const docRef = doc(db, collectionName, id);
                await updateDoc(docRef, { ...rest, updatedAt: serverTimestamp() });
                showToast(`Cập nhật thành công!`);
            } else { // Add
                await addDoc(collection(db, collectionName), { ...data, createdAt: serverTimestamp() });
                showToast(`Thêm mới thành công!`);
            }
        } catch (error) {
            console.error(`Lỗi khi xử lý ${collectionName}:`, error);
            showToast(`Lỗi: Thao tác thất bại.`);
        }
    };

    const handleDeleteGeneric = async (collectionName, id, setConfirmModalOpen, setItemToDelete) => {
        try {
            await deleteDoc(doc(db, collectionName, id));
            showToast(`Xóa thành công!`);
        } catch (error) {
            console.error(`Lỗi khi xóa ${collectionName}:`, error);
            showToast(`Lỗi: Không thể xóa.`);
        } finally {
            setConfirmModalOpen(false);
            setItemToDelete(null);
        }
    };

    // HIỂN THỊ MÀN HÌNH TẢI HOẶC NULL KHI CHƯA SẴN SÀNG
    if (authLoading || dataLoading) {
        console.log("RENDER: Hiển thị màn hình tải Settings. authLoading:", authLoading, "dataLoading:", dataLoading);
        return (
            <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                <p className="text-lg font-semibold">Đang tải cài đặt...</p>
            </div>
        );
    }

    if (!user) { // Sau khi authLoading đã false và dataLoading đã false
        console.log("RENDER: Không có người dùng, trả về null.");
        return null;
    }

    return (
        <div className="flex min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
            <Sidebar />

            <main className="flex-1 ml-64 p-8">
                <h1 className="text-3xl font-bold mb-8">Cài đặt Hệ thống</h1>

                <section className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md mb-8">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4"><Store size={24} /> Thông tin Cửa hàng</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Tên cửa hàng</label>
                            <input type="text" name="name" value={storeInfo.name} onChange={handleStoreInfoChange} className="w-full px-3 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Địa chỉ</label>
                            <input type="text" name="address" value={storeInfo.address} onChange={handleStoreInfoChange} className="w-full px-3 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Số điện thoại</label>
                            <input type="tel" name="phone" value={storeInfo.phone} onChange={handleStoreInfoChange} className="w-full px-3 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Email</label>
                            <input type="email" name="email" value={storeInfo.email} onChange={handleStoreInfoChange} className="w-full px-3 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Logo</label>
                            <div className="flex items-center space-x-4">
                                <img src={logoPreviewUrl || 'https://placehold.co/100x100/e2e8f0/64748b?text=Logo'} alt="Logo Preview" className="w-24 h-24 object-contain rounded-lg border bg-slate-50 dark:bg-slate-700 dark:border-slate-600"/>
                                <input type="file" accept="image/*" onChange={handleLogoFileChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-slate-700 dark:file:text-slate-200 dark:hover:file:bg-slate-600" />
                            </div>
                        </div>
                    </div>
                    <div className="mt-6 text-right">
                        <button onClick={handleSaveStoreInfo} className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Lưu thông tin</button>
                    </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <section className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                        <h2 className="text-xl font-bold flex items-center gap-2 mb-4"><Tag size={22} /> Quản lý Danh mục</h2>
                        <div className="text-right mb-4"><button onClick={() => { setSelectedCategory(null); setIsCategoryModalOpen(true); }} className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700"><Plus size={16} /> Thêm</button></div>
                        <table className="min-w-full text-sm">
                        <tbody>
                                {categories.map(cat => (
                                    <tr key={cat.id} className="border-b dark:border-slate-700 last:border-0">
                                        <td className="py-2 font-medium">{cat.name}</td>
                                        <td className="py-2 flex justify-end items-center space-x-2">
                                            <button onClick={() => { setSelectedCategory(cat); setIsCategoryModalOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-full"><Edit size={16} /></button>
                                            <button onClick={() => { setCategoryToDelete(cat.id); setIsConfirmCategoryModalOpen(true); }} className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full"><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                    <section className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                        <h2 className="text-xl font-bold flex items-center gap-2 mb-4"><Scale size={22} /> Quản lý Đơn vị tính</h2>
                        <div className="text-right mb-4"><button onClick={() => { setSelectedUnit(null); setIsUnitModalOpen(true); }} className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700"><Plus size={16} /> Thêm</button></div>
                        <table className="min-w-full text-sm">
                        <tbody>
                                {units.map(unit => (
                                    <tr key={unit.id} className="border-b dark:border-slate-700 last:border-0">
                                        <td className="py-2 font-medium">{unit.name}</td>
                                        <td className="py-2 flex justify-end items-center space-x-2">
                                            <button onClick={() => { setSelectedUnit(unit); setIsUnitModalOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-full"><Edit size={16} /></button>
                                            <button onClick={() => { setUnitToDelete(unit.id); setIsConfirmUnitModalOpen(true); }} className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full"><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                </div>
            </main>

            <Toast message={toast.message} show={toast.show} />
            <GenericFormModal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} item={selectedCategory} onSave={(data) => handleAddOrEditGeneric('categories', data)} title={selectedCategory ? "Sửa Danh mục" : "Thêm Danh mục"} fields={[{ name: 'name', label: 'Tên danh mục', required: true }]} />
            <ConfirmModal isOpen={isConfirmCategoryModalOpen} title="Xóa Danh mục" message="Bạn chắc chắn muốn xóa danh mục này?" onConfirm={() => handleDeleteGeneric('categories', categoryToDelete, setIsConfirmCategoryModalOpen, setCategoryToDelete)} onCancel={() => setIsConfirmCategoryModalOpen(false)} />
            <GenericFormModal isOpen={isUnitModalOpen} onClose={() => setIsUnitModalOpen(false)} item={selectedUnit} onSave={(data) => handleAddOrEditGeneric('units', data)} title={selectedUnit ? "Sửa Đơn vị" : "Thêm Đơn vị"} fields={[{ name: 'name', label: 'Tên đơn vị', required: true }]} />
            <ConfirmModal isOpen={isConfirmUnitModalOpen} title="Xóa Đơn vị" message="Bạn chắc chắn muốn xóa đơn vị này?" onConfirm={() => handleDeleteGeneric('units', unitToDelete, setIsConfirmUnitModalOpen, setUnitToDelete)} onCancel={() => setIsConfirmUnitModalOpen(false)} />
        </div>
    );
}