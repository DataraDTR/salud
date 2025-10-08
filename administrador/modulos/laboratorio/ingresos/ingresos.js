const { initializeApp, getAuth, onAuthStateChanged, setPersistence, browserSessionPersistence } = window.firebaseModules;
const { getFirestore, collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, orderBy, getDoc } = window.firebaseModules;

const firebaseConfig = {
    apiKey: "AIzaSyD6JY7FaRqjZoN6OzbFHoIXxd-IJL3H-Ek",
    authDomain: "datara-salud.firebaseapp.com",
    projectId: "datara-salud",
    storageBucket: "datara-salud.firebasestorage.app",
    messagingSenderId: "198886910481",
    appId: "1:198886910481:web:abbc345203a423a6329fb0",
    measurementId: "G-MLYVTZPPLD"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

setPersistence(auth, browserSessionPersistence);

let ingresos = [];
let currentPage = 1;
let mesesDisponibles = [];
let ingresosPorMesAno = {};
let anos = new Set();
let mesesPorAno = {};
let searchNumeroFactura = '';
let searchProveedor = '';
let searchOrdenCompra = '';
let searchActa = '';
let searchSalidas = '';
let fechaDesde = '';
let fechaHasta = '';
let selectedAno = new Date().getFullYear().toString();
let selectedMes = '';

function parseDateDDMMYYYY(dateStr) {
    if (!dateStr) return null;
    if (typeof dateStr === 'object' && 'toDate' in dateStr) {
        const date = dateStr.toDate();
        return date && !isNaN(date) ? date : null;
    }
    const normalized = String(dateStr).replace(/[\/.]/g, '-');
    const [day, month, year] = normalized.split('-').map(Number);
    if (!day || !month || !year || isNaN(day) || isNaN(month) || isNaN(year)) return null;
    return new Date(year, month - 1, day);
}

function formatDateToDDMMYYYY(date) {
    if (!date || isNaN(new Date(date))) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

function formatDateToYYYYMMDD(date) {
    if (!date || isNaN(new Date(date))) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
}

function excelSerialToDate(serial) {
    if (!serial || isNaN(serial)) return null;
    const excelEpoch = new Date(1899, 11, 30);
    const days = Math.floor(serial);
    const milliseconds = (serial - days) * 24 * 60 * 60 * 1000;
    const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000 + milliseconds);
    return date;
}

function formatNumberWithThousandsSeparator(number) {
    if (!number) return '';
    const cleaned = String(number).replace(/[^\d]/g, '');
    return cleaned ? Number(cleaned).toLocaleString('es-CL') : '';
}

async function getOrdenByCodigo(codigo) {
    if (!codigo || typeof codigo !== 'string') return null;
    const q = query(collection(db, "ordenes"), where("codigo", "==", codigo.trim()));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    }
    return null;
}

async function getIngresoByUniqueKey(numeroFactura, excludeId = null) {
    if (!numeroFactura) return null;
    const q = query(collection(db, "ingresos_lab"), where("numeroFactura", "==", numeroFactura.trim()));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        if (excludeId && doc.id === excludeId) return null;
        return { id: doc.id, ...doc.data() };
    }
    return null;
}

async function logAction(ingresoId, action, oldData = null, newData = null) {
    if (!window.currentUserData) {
        console.warn('Datos del usuario no disponibles para log');
        return;
    }
    await addDoc(collection(db, "ingresos_lab_historial"), {
        ingresoId,
        action,
        timestamp: new Date(),
        userId: auth.currentUser ? auth.currentUser.uid : null,
        userFullName: window.currentUserData.fullName || 'Usuario Invitado',
        username: window.currentUserData.username || 'invitado',
        oldData,
        newData
    });
}

async function fixInvalidDateFormats() {
    try {
        const querySnapshot = await getDocs(collection(db, "ingresos_lab"));
        let fixedCount = 0;
        showLoading();

        for (const doc of querySnapshot.docs) {
            const data = doc.data();
            let needsUpdate = false;
            const updates = {};

            const convertTimestampToString = (value) => {
                if (value && typeof value === 'object' && 'toDate' in value) {
                    const date = value.toDate();
                    return formatDateToDDMMYYYY(date);
                }
                return value;
            };

            if (data.fechaIngreso && typeof data.fechaIngreso === 'object' && 'toDate' in data.fechaIngreso) {
                updates.fechaIngreso = convertTimestampToString(data.fechaIngreso);
                needsUpdate = true;
            }
            if (data.fechaFactura && typeof data.fechaFactura === 'object' && 'toDate' in data.fechaFactura) {
                updates.fechaFactura = convertTimestampToString(data.fechaFactura);
                needsUpdate = true;
            }
            if (data.fechaOc && typeof data.fechaOc === 'object' && 'toDate' in data.fechaOc) {
                updates.fechaOc = convertTimestampToString(data.fechaOc);
                needsUpdate = true;
            }
            if (data.fechaSalida && typeof data.fechaSalida === 'object' && 'toDate' in data.fechaSalida) {
                updates.fechaSalida = convertTimestampToString(data.fechaSalida);
                needsUpdate = true;
            }

            if (needsUpdate) {
                console.log(`Corrigiendo documento ${doc.id}:`, updates);
                await updateDoc(doc.ref, updates);
                fixedCount++;
            }
        }

        hideLoading();
        showToast(`Se corrigieron ${fixedCount} documentos con fechas inválidas.`, 'success');
        await loadIngresos();
        populateAnoSelect(document.getElementById('selectAno'));
        populateAnoSelect(document.getElementById('selectDownloadAno'));
    } catch (error) {
        hideLoading();
        showToast('Error al corregir formatos de fecha: ' + error.message, 'error');
        console.error('Error en fixInvalidDateFormats:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const loading = document.getElementById('ingresos-loading');
    const importProgress = document.getElementById('ingresos-import-progress');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const toast = document.getElementById('ingresos-toast');
    const ingresosBody = document.getElementById('ingresosBody');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const pageNumbers = document.getElementById('pageNumbers');
    const paginationInfo = document.getElementById('paginationInfo');
    const fechaIngresoInput = document.getElementById('fechaIngreso');
    const numeroFacturaInput = document.getElementById('numeroFactura');
    const fechaFacturaInput = document.getElementById('fechaFactura');
    const montoInput = document.getElementById('monto');
    const ordenCompraInput = document.getElementById('ordenCompra');
    const actaInput = document.getElementById('acta');
    const salidaInput = document.getElementById('salida');
    const fechaOcInput = document.getElementById('fechaOc');
    const proveedorInput = document.getElementById('proveedor');
    const fechaSalidaInput = document.getElementById('fechaSalida');
    const ingresarBtn = document.getElementById('ingresarBtn');
    const buscarNumeroFacturaInput = document.getElementById('buscarNumeroFactura');
    const buscarProveedorInput = document.getElementById('buscarProveedor');
    const buscarOrdenCompraInput = document.getElementById('buscarOrdenCompra');
    const buscarActaInput = document.getElementById('buscarActa');
    const buscarSalidasInput = document.getElementById('buscarSalidas');
    const fechaDesdeInput = document.getElementById('fechaDesde');
    const fechaHastaInput = document.getElementById('fechaHasta');
    const selectAno = document.getElementById('selectAno');
    const selectMes = document.getElementById('selectMes');
    const downloadMesModal = document.getElementById('downloadMesModal');
    const closeDownloadMes = document.getElementById('closeDownloadMes');
    const cancelDownloadMes = document.getElementById('cancelDownloadMes');
    const confirmDownloadMes = document.getElementById('confirmDownloadMes');
    const selectDownloadAno = document.getElementById('selectDownloadAno');
    const selectDownloadMes = document.getElementById('selectDownloadMes');
    const actionsBtn = document.getElementById('actionsBtn');
    const actionsMenu = document.getElementById('actionsMenu');
    const downloadTemplate = document.getElementById('downloadTemplate');
    const importExcel = document.getElementById('importExcel');
    const downloadAll = document.getElementById('downloadAll');
    const downloadPage = document.getElementById('downloadPage');
    const downloadMes = document.getElementById('downloadMes');
    const fixDates = document.getElementById('fixDates');
    const fileUpload = document.getElementById('fileUpload');
    const editModal = document.getElementById('editModal');
    const deleteModal = document.getElementById('deleteModal');
    const historyModal = document.getElementById('historyModal');
    const closeEditModal = document.getElementById('closeEditModal');
    const cancelEdit = document.getElementById('cancelEdit');
    const editForm = document.getElementById('editForm');
    const closeDeleteModal = document.getElementById('closeDeleteModal');
    const cancelDelete = document.getElementById('cancelDelete');
    const confirmDelete = document.getElementById('confirmDelete');
    const deleteText = document.getElementById('deleteText');
    const closeHistory = document.getElementById('closeHistory');
    const closeHistoryBtn = document.getElementById('closeHistoryBtn');
    const historyTitle = document.getElementById('historyTitle');
    const historyContent = document.getElementById('historyContent');

    let currentEditId = null;
    let currentEditOldData = null;
    let currentDeleteId = null;
    let currentDeleteNumeroFactura = null;

    const today = formatDateToYYYYMMDD(new Date());
    fechaIngresoInput.value = today;
    fechaFacturaInput.value = today;
    fechaSalidaInput.value = today;
    document.getElementById('editFechaIngreso').value = today;
    document.getElementById('editFechaFactura').value = today;
    document.getElementById('editFechaSalida').value = today;

    function formatMontoInput(input) {
        input.addEventListener('input', (e) => {
            const value = e.target.value.replace(/[^\d]/g, '');
            e.target.value = formatNumberWithThousandsSeparator(value);
        });
    }

    formatMontoInput(montoInput);
    formatMontoInput(document.getElementById('editMonto'));

    window.showLoading = function () {
        if (loading) loading.classList.add('show');
    };

    window.hideLoading = function () {
        if (loading) loading.classList.remove('show');
    };

    function showImportProgress(percent) {
        if (importProgress && progressBar && progressText) {
            importProgress.classList.add('show');
            progressBar.style.width = `${percent}%`;
            progressText.textContent = `Importando: ${Math.round(percent)}%`;
        }
    }

    function hideImportProgress() {
        if (importProgress) {
            importProgress.classList.remove('show');
            progressBar.style.width = '0%';
            progressText.textContent = 'Importando: 0%';
        }
    }

    function showToast(text, type = 'success') {
        if (toast) {
            toast.textContent = text;
            toast.className = `ingresos-toast ${type}`;
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, 5000);
        }
    }

    window.openEditModal = function (id, ingreso) {
        currentEditId = id;
        currentEditOldData = { ...ingreso };
        document.getElementById('editId').value = id;
        document.getElementById('editFechaIngreso').value = ingreso.fechaIngreso ? formatDateToYYYYMMDD(parseDateDDMMYYYY(ingreso.fechaIngreso)) : today;
        document.getElementById('editNumeroFactura').value = ingreso.numeroFactura || '';
        document.getElementById('editFechaFactura').value = ingreso.fechaFactura ? formatDateToYYYYMMDD(parseDateDDMMYYYY(ingreso.fechaFactura)) : today;
        document.getElementById('editMonto').value = ingreso.monto ? formatNumberWithThousandsSeparator(ingreso.monto) : '';
        document.getElementById('editOrdenCompra').value = ingreso.oc || '';
        document.getElementById('editFechaOc').value = ingreso.fechaOc || '';
        document.getElementById('editProveedor').value = ingreso.proveedor || '';
        document.getElementById('editActa').value = ingreso.acta || '';
        document.getElementById('editFechaSalida').value = ingreso.fechaSalida ? formatDateToYYYYMMDD(parseDateDDMMYYYY(ingreso.fechaSalida)) : today;
        document.getElementById('editSalida').value = ingreso.salida || '';
        editModal.style.display = 'block';
    };

    function closeEditModalHandler() {
        editModal.style.display = 'none';
        currentEditId = null;
        currentEditOldData = null;
        editForm.reset();
        document.getElementById('editFechaIngreso').value = today;
        document.getElementById('editFechaFactura').value = today;
        document.getElementById('editFechaSalida').value = today;
    }

    window.openDeleteModal = function (id, numeroFactura) {
        currentDeleteId = id;
        currentDeleteNumeroFactura = numeroFactura;
        deleteText.textContent = `¿Desea eliminar el ingreso con número de factura "${numeroFactura}"?`;
        deleteModal.style.display = 'block';
    };

    function closeDeleteModalHandler() {
        deleteModal.style.display = 'none';
        currentDeleteId = null;
        currentDeleteNumeroFactura = null;
    }

    window.openHistoryModal = function (id, numeroFactura) {
        historyTitle.textContent = `HISTORIAL INGRESO ${numeroFactura}`;
        showLoading();
        const q = query(collection(db, "ingresos_lab_historial"), where("ingresoId", "==", id), orderBy("timestamp", "desc"));
        getDocs(q).then((querySnapshot) => {
            hideLoading();
            let html = '';
            querySnapshot.forEach((doc) => {
                const log = doc.data();
                const date = log.timestamp ? log.timestamp.toDate().toLocaleString('es-CL') : 'Fecha inválida';
                if (log.action === 'create') {
                    html += `<div class="history-entry">Creado | ${log.userFullName || 'Desconocido'} | ${log.username || 'desconocido'} | ${date}</div>`;
                } else if (log.action === 'update') {
                    html += `<div class="history-entry">Modificado | ${log.userFullName || 'Desconocido'} | ${log.username || 'desconocido'} | ${date} | Factura: ${log.oldData ? log.oldData.numeroFactura : 'N/A'} → ${log.newData ? log.newData.numeroFactura : 'N/A'}</div>`;
                } else if (log.action === 'delete') {
                    html += `<div class="history-entry">Eliminado | ${log.userFullName || 'Desconocido'} | ${log.username || 'desconocido'} | ${date}</div>`;
                }
            });
            historyContent.innerHTML = html || '<div>No hay historial disponible.</div>';
            historyModal.style.display = 'block';
        }).catch((error) => {
            hideLoading();
            showToast('Error al cargar el historial: ' + error.message, 'error');
        });
    };

    function closeHistoryModalHandler() {
        historyModal.style.display = 'none';
        historyContent.innerHTML = '';
    }

    closeEditModal.addEventListener('click', closeEditModalHandler);
    cancelEdit.addEventListener('click', closeEditModalHandler);
    window.addEventListener('click', (e) => {
        if (e.target === editModal) closeEditModalHandler();
    });

    closeDeleteModal.addEventListener('click', closeDeleteModalHandler);
    cancelDelete.addEventListener('click', closeDeleteModalHandler);
    window.addEventListener('click', (e) => {
        if (e.target === deleteModal) closeDeleteModalHandler();
    });

    closeHistory.addEventListener('click', closeHistoryModalHandler);
    closeHistoryBtn.addEventListener('click', closeHistoryModalHandler);
    window.addEventListener('click', (e) => {
        if (e.target === historyModal) closeHistoryModalHandler();
    });

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentEditId) return;

        const processedRow = {
            fechaIngreso: document.getElementById('editFechaIngreso').value ? formatDateToDDMMYYYY(parseDateDDMMYYYY(document.getElementById('editFechaIngreso').value.replace(/-/g, '/'))) : '',
            numeroFactura: document.getElementById('editNumeroFactura').value.trim(),
            fechaFactura: document.getElementById('editFechaFactura').value ? formatDateToDDMMYYYY(parseDateDDMMYYYY(document.getElementById('editFechaFactura').value.replace(/-/g, '/'))) : '',
            monto: document.getElementById('editMonto').value.replace(/[^\d]/g, ''),
            oc: document.getElementById('editOrdenCompra').value.trim(),
            fechaOc: document.getElementById('editFechaOc').value,
            proveedor: document.getElementById('editProveedor').value,
            acta: document.getElementById('editActa').value.trim(),
            fechaSalida: document.getElementById('editFechaSalida').value ? formatDateToDDMMYYYY(parseDateDDMMYYYY(document.getElementById('editFechaSalida').value.replace(/-/g, '/'))) : '',
            salida: document.getElementById('editSalida').value.trim(),
            fullName: window.currentUserData.fullName
        };

        if (processedRow.numeroFactura && processedRow.fechaIngreso) {
            showLoading();
            try {
                const existing = await getIngresoByUniqueKey(processedRow.numeroFactura, currentEditId);
                if (existing) {
                    hideLoading();
                    showToast('El número de factura ya existe.', 'error');
                    return;
                }
                await updateDoc(doc(db, "ingresos_lab", currentEditId), {
                    ...processedRow,
                    createdAt: new Date()
                });
                await logAction(currentEditId, 'update', currentEditOldData, processedRow);
                hideLoading();
                showToast(`Ingreso ${processedRow.numeroFactura} actualizado exitosamente`, 'success');
                closeEditModalHandler();
                await loadIngresos();
            } catch (error) {
                hideLoading();
                showToast('Error al actualizar el ingreso: ' + error.message, 'error');
            }
        } else {
            showToast('Faltan número de factura o fecha de ingreso', 'error');
        }
    });

    confirmDelete.addEventListener('click', async () => {
        if (!currentDeleteId || !currentDeleteNumeroFactura) return;

        showLoading();
        try {
            const ingresoDoc = await getDoc(doc(db, "ingresos_lab", currentDeleteId));
            if (ingresoDoc.exists()) {
                const ingresoData = ingresoDoc.data();
                await logAction(currentDeleteId, 'delete', ingresoData);
                await deleteDoc(doc(db, "ingresos_lab", currentDeleteId));
                hideLoading();
                showToast(`Ingreso ${currentDeleteNumeroFactura} eliminado exitosamente`, 'success');
                closeDeleteModalHandler();
                await loadIngresos();
            } else {
                hideLoading();
                showToast('El ingreso no existe.', 'error');
                closeDeleteModalHandler();
            }
        } catch (error) {
            hideLoading();
            showToast('Error al eliminar el ingreso: ' + error.message, 'error');
        }
    });

    function openDownloadMesModal() {
        populateAnoSelect(selectDownloadAno);
        selectDownloadAno.value = selectedAno;
        populateMesSelect(selectDownloadMes, selectDownloadAno.value);
        downloadMesModal.style.display = 'block';
    }

    function closeDownloadMesModalHandler() {
        downloadMesModal.style.display = 'none';
    }

    closeDownloadMes.addEventListener('click', closeDownloadMesModalHandler);
    cancelDownloadMes.addEventListener('click', closeDownloadMesModalHandler);
    window.addEventListener('click', (e) => {
        if (e.target === downloadMesModal) closeDownloadMesModalHandler();
    });

    confirmDownloadMes.addEventListener('click', async () => {
        const ano = selectDownloadAno.value;
        const mes = selectDownloadMes.value;
        if (ano && mes) {
            showLoading();
            try {
                const data = await getIngresosByMes(ano, mes);
                exportToExcel(data.map(i => ({
                    fechaIngreso: formatDateToDDMMYYYY(parseDateDDMMYYYY(i.fechaIngreso)),
                    numeroFactura: i.numeroFactura,
                    fechaFactura: formatDateToDDMMYYYY(parseDateDDMMYYYY(i.fechaFactura)),
                    monto: formatNumberWithThousandsSeparator(i.monto),
                    oc: i.oc,
                    fechaOc: formatDateToDDMMYYYY(parseDateDDMMYYYY(i.fechaOc)),
                    proveedor: i.proveedor,
                    acta: i.acta,
                    fechaSalida: formatDateToDDMMYYYY(parseDateDDMMYYYY(i.fechaSalida)),
                    salida: i.salida,
                    fullName: i.fullName
                })), `ingresos_${ano}_${mes}`);
                hideLoading();
                closeDownloadMesModalHandler();
            } catch (error) {
                hideLoading();
                showToast('Error al descargar el mes: ' + error.message, 'error');
            }
        } else {
            showToast('Por favor, selecciona año y mes.', 'error');
        }
    });

    async function getIngresosByMes(ano, mes) {
        const mesAno = `${mes} ${ano}`;
        return ingresosPorMesAno[mesAno] || [];
    }

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.replace('../index.html');
            return;
        }
        try {
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                window.currentUserData = userDoc.data();
            } else {
                window.currentUserData = { fullName: user.displayName || 'Usuario Invitado', username: user.email || 'invitado' };
            }
        } catch (error) {
            console.error('Error al cargar datos del usuario:', error);
            window.currentUserData = { fullName: 'Usuario Invitado', username: 'invitado' };
            showToast('Error al cargar datos del usuario.', 'error');
        }
        await loadIngresos();
        populateAnoSelect(selectAno);
        selectAno.value = selectedAno;
        populateMesSelect(selectMes, selectedAno);
        populateAnoSelect(selectDownloadAno);
    });

    if (buscarNumeroFacturaInput) {
        buscarNumeroFacturaInput.addEventListener('input', (e) => {
            searchNumeroFactura = e.target.value.trim();
            currentPage = 1;
            renderTable();
        });
    }

    if (buscarProveedorInput) {
        buscarProveedorInput.addEventListener('input', (e) => {
            searchProveedor = e.target.value.trim();
            currentPage = 1;
            renderTable();
        });
    }

    if (buscarOrdenCompraInput) {
        buscarOrdenCompraInput.addEventListener('input', (e) => {
            searchOrdenCompra = e.target.value.trim();
            currentPage = 1;
            renderTable();
        });
    }

    if (buscarActaInput) {
        buscarActaInput.addEventListener('input', (e) => {
            searchActa = e.target.value.trim();
            currentPage = 1;
            renderTable();
        });
    }

    if (buscarSalidasInput) {
        buscarSalidasInput.addEventListener('input', (e) => {
            searchSalidas = e.target.value.trim();
            currentPage = 1;
            renderTable();
        });
    }

    if (fechaDesdeInput) {
        fechaDesdeInput.addEventListener('change', (e) => {
            fechaDesde = e.target.value;
            currentPage = 1;
            renderTable();
        });
    }

    if (fechaHastaInput) {
        fechaHastaInput.addEventListener('change', (e) => {
            fechaHasta = e.target.value;
            currentPage = 1;
            renderTable();
        });
    }

    if (selectAno) {
        selectAno.addEventListener('change', (e) => {
            selectedAno = e.target.value;
            populateMesSelect(selectMes, selectedAno);
            currentPage = 1;
            renderTable();
        });
    }

    if (selectMes) {
        selectMes.addEventListener('change', (e) => {
            selectedMes = e.target.value;
            currentPage = 1;
            renderTable();
        });
    }

    if (selectDownloadAno) {
        selectDownloadAno.addEventListener('change', (e) => {
            populateMesSelect(selectDownloadMes, e.target.value);
        });
    }

    if (ordenCompraInput) {
        ordenCompraInput.addEventListener('input', async (e) => {
            const codigo = e.target.value.trim();
            if (codigo) {
                showLoading();
                try {
                    const orden = await getOrdenByCodigo(codigo);
                    if (orden) {
                        proveedorInput.value = orden.proveedor || '';
                        fechaOcInput.value = formatDateToDDMMYYYY(parseDateDDMMYYYY(orden.generacion)) || '';
                    } else {
                        proveedorInput.value = '';
                        fechaOcInput.value = '';
                        showToast('No se encontró una orden con ese código', 'error');
                    }
                    hideLoading();
                } catch (error) {
                    hideLoading();
                    showToast('Error al buscar la orden: ' + error.message, 'error');
                    proveedorInput.value = '';
                    fechaOcInput.value = '';
                }
            } else {
                proveedorInput.value = '';
                fechaOcInput.value = '';
            }
        });
    }

    if (document.getElementById('editOrdenCompra')) {
        document.getElementById('editOrdenCompra').addEventListener('input', async (e) => {
            const codigo = e.target.value.trim();
            if (codigo) {
                showLoading();
                try {
                    const orden = await getOrdenByCodigo(codigo);
                    if (orden) {
                        document.getElementById('editProveedor').value = orden.proveedor || '';
                        document.getElementById('editFechaOc').value = formatDateToDDMMYYYY(parseDateDDMMYYYY(orden.generacion)) || '';
                    } else {
                        document.getElementById('editProveedor').value = '';
                        document.getElementById('editFechaOc').value = '';
                        showToast('No se encontró una orden con ese código', 'error');
                    }
                    hideLoading();
                } catch (error) {
                    hideLoading();
                    showToast('Error al buscar la orden: ' + error.message, 'error');
                    document.getElementById('editProveedor').value = '';
                    document.getElementById('editFechaOc').value = '';
                }
            } else {
                document.getElementById('editProveedor').value = '';
                document.getElementById('editFechaOc').value = '';
            }
        });
    }

    if (ingresarBtn) {
        ingresarBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const processedRow = {
                fechaIngreso: fechaIngresoInput.value ? formatDateToDDMMYYYY(parseDateDDMMYYYY(fechaIngresoInput.value.replace(/-/g, '/'))) : '',
                numeroFactura: numeroFacturaInput.value.trim(),
                fechaFactura: fechaFacturaInput.value ? formatDateToDDMMYYYY(parseDateDDMMYYYY(fechaFacturaInput.value.replace(/-/g, '/'))) : '',
                monto: montoInput.value.replace(/[^\d]/g, ''),
                oc: ordenCompraInput.value.trim(),
                fechaOc: fechaOcInput.value,
                proveedor: proveedorInput.value,
                acta: actaInput.value.trim(),
                fechaSalida: fechaSalidaInput.value ? formatDateToDDMMYYYY(parseDateDDMMYYYY(fechaSalidaInput.value.replace(/-/g, '/'))) : '',
                salida: salidaInput.value.trim(),
                fullName: window.currentUserData.fullName
            };

            if (processedRow.numeroFactura && processedRow.fechaIngreso) {
                showLoading();
                try {
                    const existing = await getIngresoByUniqueKey(processedRow.numeroFactura);
                    if (existing) {
                        hideLoading();
                        showToast('El número de factura ya existe.', 'error');
                        return;
                    }
                    const docRef = await addDoc(collection(db, "ingresos_lab"), {
                        ...processedRow,
                        createdAt: new Date()
                    });
                    await logAction(docRef.id, 'create', null, processedRow);
                    hideLoading();
                    showToast(`Ingreso ${processedRow.numeroFactura} registrado exitosamente`, 'success');
                    fechaIngresoInput.value = today;
                    numeroFacturaInput.value = '';
                    fechaFacturaInput.value = today;
                    montoInput.value = '';
                    ordenCompraInput.value = '';
                    actaInput.value = '';
                    salidaInput.value = '';
                    fechaOcInput.value = '';
                    proveedorInput.value = '';
                    fechaSalidaInput.value = today;
                    await loadIngresos();
                } catch (error) {
                    hideLoading();
                    showToast('Error al registrar el ingreso: ' + error.message, 'error');
                }
            } else {
                showToast('Faltan número de factura o fecha de ingreso', 'error');
            }
        });
    }

    if (fixDates) {
        fixDates.addEventListener('click', (e) => {
            e.preventDefault();
            fixInvalidDateFormats();
            actionsMenu.style.display = 'none';
        });
    }

    async function loadIngresos() {
        showLoading();
        try {
            const querySnapshot = await getDocs(collection(db, "ingresos_lab"));
            ingresos = [];
            anos = new Set();
            mesesPorAno = {};
            ingresosPorMesAno = {};
            mesesDisponibles = [];

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                let fechaIngreso = data.fechaIngreso;
                let fechaFactura = data.fechaFactura;
                let fechaOc = data.fechaOc;
                let fechaSalida = data.fechaSalida;

                if (fechaIngreso && typeof fechaIngreso === 'object' && 'toDate' in fechaIngreso) {
                    fechaIngreso = formatDateToDDMMYYYY(fechaIngreso.toDate());
                }
                if (fechaFactura && typeof fechaFactura === 'object' && 'toDate' in fechaFactura) {
                    fechaFactura = formatDateToDDMMYYYY(fechaFactura.toDate());
                }
                if (fechaOc && typeof fechaOc === 'object' && 'toDate' in fechaOc) {
                    fechaOc = formatDateToDDMMYYYY(fechaOc.toDate());
                }
                if (fechaSalida && typeof fechaSalida === 'object' && 'toDate' in fechaSalida) {
                    fechaSalida = formatDateToDDMMYYYY(fechaSalida.toDate());
                }

                if (!fechaIngreso || typeof fechaIngreso !== 'string' || !parseDateDDMMYYYY(fechaIngreso)) {
                    console.warn(`Documento ${doc.id} tiene fechaIngreso inválida: ${data.fechaIngreso}`);
                    return;
                }

                const ingreso = {
                    id: doc.id,
                    ...data,
                    fechaIngreso,
                    fechaFactura: fechaFactura || '',
                    fechaOc: fechaOc || '',
                    fechaSalida: fechaSalida || ''
                };
                ingresos.push(ingreso);

                const fechaIngresoDate = parseDateDDMMYYYY(fechaIngreso);
                if (fechaIngresoDate && !isNaN(fechaIngresoDate)) {
                    const ano = fechaIngresoDate.getFullYear();
                    const mes = fechaIngresoDate.toLocaleString('es-CL', { month: 'long' });
                    const mesAno = `${mes} ${ano}`;
                    anos.add(ano);
                    if (!mesesPorAno[ano]) mesesPorAno[ano] = new Set();
                    mesesPorAno[ano].add(mes);
                    if (!ingresosPorMesAno[mesAno]) ingresosPorMesAno[mesAno] = [];
                    ingresosPorMesAno[mesAno].push(ingreso);
                }
            });

            mesesDisponibles = Object.keys(ingresosPorMesAno).sort((a, b) => {
                const [mesA, anoA] = a.split(' ');
                const [mesB, anoB] = b.split(' ');
                const dateA = new Date(`${mesA} 1, ${anoA}`);
                const dateB = new Date(`${mesB} 1, ${anoB}`);
                return dateA - dateB;
            });

            console.log('Meses disponibles:', mesesDisponibles);
            console.log('Ingresos por mes:', ingresosPorMesAno);

            ingresos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            renderTable();
            hideLoading();
        } catch (error) {
            hideLoading();
            showToast('Error al cargar los ingresos: ' + error.message, 'error');
            console.error('Error en loadIngresos:', error);
        }
    }

    function populateAnoSelect(select) {
        select.innerHTML = '<option value="">Todos</option>';
        Array.from(anos).sort((a, b) => b - a).forEach(ano => {
            const option = document.createElement('option');
            option.value = ano;
            option.textContent = ano;
            select.appendChild(option);
        });
    }

    function populateMesSelect(select, ano) {
        select.innerHTML = '<option value="">Todos</option>';
        if (ano && mesesPorAno[ano]) {
            Array.from(mesesPorAno[ano]).sort((a, b) => new Date(Date.parse('01 ' + a + ' 2000')) - new Date(Date.parse('01 ' + b + ' 2000'))).forEach(mes => {
                const option = document.createElement('option');
                option.value = mes;
                option.textContent = mes;
                select.appendChild(option);
            });
        }
    }

    function getFilteredIngresos() {
        console.log('Filtros activos:', {
            searchNumeroFactura,
            searchProveedor,
            searchOrdenCompra,
            searchActa,
            searchSalidas,
            fechaDesde,
            fechaHasta,
            selectedAno,
            selectedMes
        });

        if (selectedMes && selectedAno) {
            const mesAno = `${selectedMes} ${selectedAno}`;
            return (ingresosPorMesAno[mesAno] || []).filter(ingreso => {
                return (
                    String(ingreso.numeroFactura || '').toLowerCase().includes(searchNumeroFactura.toLowerCase()) &&
                    String(ingreso.proveedor || '').toLowerCase().includes(searchProveedor.toLowerCase()) &&
                    String(ingreso.oc || '').toLowerCase().includes(searchOrdenCompra.toLowerCase()) &&
                    String(ingreso.acta || '').toLowerCase().includes(searchActa.toLowerCase()) &&
                    String(ingreso.salida || '').toLowerCase().includes(searchSalidas.toLowerCase()) &&
                    (!fechaDesde || parseDateDDMMYYYY(ingreso.fechaIngreso) >= parseDateDDMMYYYY(fechaDesde.replace(/-/g, '/'))) &&
                    (!fechaHasta || parseDateDDMMYYYY(ingreso.fechaIngreso) <= parseDateDDMMYYYY(fechaHasta.replace(/-/g, '/')))
                );
            }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        let filtered = ingresos.filter(ingreso => {
            const fechaIngresoDate = parseDateDDMMYYYY(ingreso.fechaIngreso);
            if (!fechaIngresoDate || isNaN(fechaIngresoDate)) {
                console.warn(`Ingreso con ID ${ingreso.id} tiene fechaIngreso inválida: ${ingreso.fechaIngreso}`);
                return false;
            }
            return (
                String(ingreso.numeroFactura || '').toLowerCase().includes(searchNumeroFactura.toLowerCase()) &&
                String(ingreso.proveedor || '').toLowerCase().includes(searchProveedor.toLowerCase()) &&
                String(ingreso.oc || '').toLowerCase().includes(searchOrdenCompra.toLowerCase()) &&
                String(ingreso.acta || '').toLowerCase().includes(searchActa.toLowerCase()) &&
                String(ingreso.salida || '').toLowerCase().includes(searchSalidas.toLowerCase()) &&
                (!fechaDesde || parseDateDDMMYYYY(ingreso.fechaIngreso) >= parseDateDDMMYYYY(fechaDesde.replace(/-/g, '/'))) &&
                (!fechaHasta || parseDateDDMMYYYY(ingreso.fechaIngreso) <= parseDateDDMMYYYY(fechaHasta.replace(/-/g, '/'))) &&
                (!selectedAno || fechaIngresoDate.getFullYear().toString() === selectedAno)
            );
        }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (!selectedMes) {
            const tempIngresosPorMesAno = {};
            filtered.forEach(ingreso => {
                const fechaIngresoDate = parseDateDDMMYYYY(ingreso.fechaIngreso);
                const mes = fechaIngresoDate.toLocaleString('es-CL', { month: 'long' });
                const ano = fechaIngresoDate.getFullYear();
                const mesAno = `${mes} ${ano}`;
                if (!tempIngresosPorMesAno[mesAno]) tempIngresosPorMesAno[mesAno] = [];
                tempIngresosPorMesAno[mesAno].push(ingreso);
            });
            mesesDisponibles = Object.keys(tempIngresosPorMesAno).sort((a, b) => {
                const [mesA, anoA] = a.split(' ');
                const [mesB, anoB] = b.split(' ');
                const dateA = new Date(`${mesA} 1, ${anoA}`);
                const dateB = new Date(`${mesB} 1, ${anoB}`);
                return dateA - dateB;
            });
            ingresosPorMesAno = tempIngresosPorMesAno;
        }

        return filtered;
    }

    function renderTable() {
        console.log('Rendering table with ingresos:', ingresos);
        const filteredIngresos = getFilteredIngresos();
        let pageIngresos = [];

        if (selectedMes && selectedAno) {
            const mesAno = `${selectedMes} ${selectedAno}`;
            pageIngresos = ingresosPorMesAno[mesAno] || [];
        } else {
            if (mesesDisponibles.length > 0 && currentPage <= mesesDisponibles.length) {
                const mesAno = mesesDisponibles[currentPage - 1];
                pageIngresos = ingresosPorMesAno[mesAno] || [];
            }
        }

        if (ingresosBody) {
            ingresosBody.innerHTML = '';
            if (pageIngresos.length === 0) {
                ingresosBody.innerHTML = '<tr><td colspan="12">No hay registros para mostrar.</td></tr>';
            } else {
                pageIngresos.forEach(ingreso => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td class="ingresos-actions">
                            <button title="Editar" class="ingresos-btn-edit" onclick="openEditModal('${ingreso.id}', ${JSON.stringify(ingreso).replace(/"/g, '&quot;')})"><i class="fas fa-edit"></i></button>
                            <button title="Eliminar" class="ingresos-btn-delete" onclick="openDeleteModal('${ingreso.id}', '${ingreso.numeroFactura}')"><i class="fas fa-trash"></i></button>
                            <button title="Ver Historial" class="ingresos-btn-history" onclick="openHistoryModal('${ingreso.id}', '${ingreso.numeroFactura}')"><i class="fas fa-history"></i></button>
                        </td>
                        <td>${formatDateToDDMMYYYY(parseDateDDMMYYYY(ingreso.fechaIngreso))}</td>
                        <td>${ingreso.numeroFactura || ''}</td>
                        <td>${formatDateToDDMMYYYY(parseDateDDMMYYYY(ingreso.fechaFactura))}</td>
                        <td>${formatNumberWithThousandsSeparator(ingreso.monto)}</td>
                        <td>${ingreso.oc || ''}</td>
                        <td>${formatDateToDDMMYYYY(parseDateDDMMYYYY(ingreso.fechaOc))}</td>
                        <td>${ingreso.proveedor || ''}</td>
                        <td>${ingreso.acta || ''}</td>
                        <td>${formatDateToDDMMYYYY(parseDateDDMMYYYY(ingreso.fechaSalida))}</td>
                        <td>${ingreso.salida || ''}</td>
                        <td>${ingreso.fullName || ''}</td>
                    `;
                    ingresosBody.appendChild(row);
                });
            }
        }

        updatePagination(pageIngresos.length);
    }

    function updatePagination(total) {
        const totalPages = selectedMes && selectedAno ? 1 : mesesDisponibles.length;
        const currentMesAno = selectedMes && selectedAno ? `${selectedMes} ${selectedAno}` : (mesesDisponibles[currentPage - 1] || 'Sin datos');

        if (paginationInfo) {
            paginationInfo.textContent = `Mostrando ${currentMesAno} | ${total} registros`;
        }

        if (prevBtn) prevBtn.disabled = currentPage === 1 || (selectedMes && selectedAno);
        if (nextBtn) nextBtn.disabled = currentPage === totalPages || (selectedMes && selectedAno);

        if (pageNumbers) {
            pageNumbers.innerHTML = '';
            if (!(selectedMes && selectedAno)) {
                const startPage = Math.max(1, currentPage - 2);
                const endPage = Math.min(totalPages, startPage + 4);

                if (startPage > 1) {
                    const btn = document.createElement('button');
                    btn.textContent = mesesDisponibles[0];
                    btn.className = 1 === currentPage ? 'active' : '';
                    btn.addEventListener('click', () => goToPage(1));
                    pageNumbers.appendChild(btn);
                    if (startPage > 2) {
                        const dots = document.createElement('span');
                        dots.textContent = '...';
                        dots.className = 'ingresos-dots';
                        pageNumbers.appendChild(dots);
                    }
                }

                for (let i = startPage; i <= endPage; i++) {
                    const btn = document.createElement('button');
                    btn.textContent = mesesDisponibles[i - 1];
                    btn.className = i === currentPage ? 'active' : '';
                    btn.addEventListener('click', () => goToPage(i));
                    pageNumbers.appendChild(btn);
                }

                if (endPage < totalPages) {
                    if (endPage < totalPages - 1) {
                        const dots = document.createElement('span');
                        dots.textContent = '...';
                        dots.className = 'ingresos-dots';
                        pageNumbers.appendChild(dots);
                    }
                    const btn = document.createElement('button');
                    btn.textContent = mesesDisponibles[totalPages - 1];
                    btn.className = totalPages === currentPage ? 'active' : '';
                    btn.addEventListener('click', () => goToPage(totalPages));
                    pageNumbers.appendChild(btn);
                }
            }
        }
    }

    function goToPage(page) {
        currentPage = page;
        renderTable();
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1 && !(selectedMes && selectedAno)) {
                currentPage--;
                renderTable();
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentPage < mesesDisponibles.length && !(selectedMes && selectedAno)) {
                currentPage++;
                renderTable();
            }
        });
    }

    actionsBtn.addEventListener('click', () => {
        actionsMenu.style.display = actionsMenu.style.display === 'block' ? 'none' : 'block';
    });

    window.addEventListener('click', (e) => {
        if (!actionsBtn.contains(e.target) && !actionsMenu.contains(e.target)) {
            actionsMenu.style.display = 'none';
        }
    });

    downloadTemplate.addEventListener('click', (e) => {
        e.preventDefault();
        downloadImportTemplate();
        actionsMenu.style.display = 'none';
    });

    importExcel.addEventListener('click', (e) => {
        e.preventDefault();
        fileUpload.click();
        actionsMenu.style.display = 'none';
    });

    downloadAll.addEventListener('click', (e) => {
        e.preventDefault();
        exportToExcel(ingresos.map(i => ({
            fechaIngreso: formatDateToDDMMYYYY(parseDateDDMMYYYY(i.fechaIngreso)),
            numeroFactura: i.numeroFactura,
            fechaFactura: formatDateToDDMMYYYY(parseDateDDMMYYYY(i.fechaFactura)),
            monto: formatNumberWithThousandsSeparator(i.monto),
            oc: i.oc,
            fechaOc: formatDateToDDMMYYYY(parseDateDDMMYYYY(i.fechaOc)),
            proveedor: i.proveedor,
            acta: i.acta,
            fechaSalida: formatDateToDDMMYYYY(parseDateDDMMYYYY(i.fechaSalida)),
            salida: i.salida,
            fullName: i.fullName
        })), 'todos_ingresos');
        actionsMenu.style.display = 'none';
    });

    downloadPage.addEventListener('click', (e) => {
        e.preventDefault();
        const currentMesAno = selectedMes && selectedAno ? `${selectedMes} ${selectedAno}` : mesesDisponibles[currentPage - 1];
        const pageData = (ingresosPorMesAno[currentMesAno] || []).map(i => ({
            fechaIngreso: formatDateToDDMMYYYY(parseDateDDMMYYYY(i.fechaIngreso)),
            numeroFactura: i.numeroFactura,
            fechaFactura: formatDateToDDMMYYYY(parseDateDDMMYYYY(i.fechaFactura)),
            monto: formatNumberWithThousandsSeparator(i.monto),
            oc: i.oc,
            fechaOc: formatDateToDDMMYYYY(parseDateDDMMYYYY(i.fechaOc)),
            proveedor: i.proveedor,
            acta: i.acta,
            fechaSalida: formatDateToDDMMYYYY(parseDateDDMMYYYY(i.fechaSalida)),
            salida: i.salida,
            fullName: i.fullName
        }));
        exportToExcel(pageData, `ingresos_${currentMesAno.replace(' ', '_')}`);
        actionsMenu.style.display = 'none';
    });

    downloadMes.addEventListener('click', (e) => {
        e.preventDefault();
        openDownloadMesModal();
        actionsMenu.style.display = 'none';
    });

    fileUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            await importFromExcel(file);
            fileUpload.value = '';
        }
    });

    function exportToExcel(data, filename) {
        const ws = XLSX.utils.json_to_sheet(data, {
            dateNF: 'dd-mm-yyyy',
            cellDates: true
        });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Ingresos");
        XLSX.writeFile(wb, filename + '.xlsx');
    }

    function downloadImportTemplate() {
        const ws = XLSX.utils.aoa_to_sheet([[
            "Fecha de Ingreso", "Número de Factura", "Fecha de Factura", "Monto", "OC", "Fecha de OC", "Proveedor", "Acta", "Fecha de Salida", "Salida", "Nombre Completo"
        ], [
            "18-06-2025", "FACT001", "18-06-2025", "10000", "OC001", "18-06-2025", "Proveedor A", "ACTA001", "18-06-2025", "Salida 1", "Usuario Ejemplo"
        ]]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, 'template_ingresos.xlsx');
    }

    async function importFromExcel(file) {
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const data = new Uint8Array(e.target.result);
                const wb = XLSX.read(data, { type: 'array', cellDates: true, dateNF: 'dd-mm-yyyy' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(ws, {
                    header: ["fechaIngreso", "numeroFactura", "fechaFactura", "monto", "oc", "fechaOc", "proveedor", "acta", "fechaSalida", "salida", "fullName"],
                    range: 1,
                    defval: ''
                });

                console.log('Datos crudos del Excel:', json);

                let addedCount = 0;
                let updatedCount = 0;
                const totalRows = json.length;

                showImportProgress(0);

                for (let i = 0; i < json.length; i++) {
                    const row = json[i];
                    console.log(`Procesando fila ${i + 2}:`, row);

                    let fechaIngreso = '';
                    let fechaFactura = '';
                    let fechaOc = '';
                    let fechaSalida = '';

                    if (row.fechaIngreso) {
                        if (typeof row.fechaIngreso === 'number') {
                            const date = excelSerialToDate(row.fechaIngreso);
                            fechaIngreso = date && !isNaN(date) ? formatDateToDDMMYYYY(date) : '';
                            console.log(`Fila ${i + 2}: fechaIngreso (serial: ${row.fechaIngreso}) procesada: ${fechaIngreso}`);
                        } else if (typeof row.fechaIngreso === 'string') {
                            const parsedDate = parseDateDDMMYYYY(row.fechaIngreso.replace(/[\/.]/g, '-'));
                            fechaIngreso = parsedDate && !isNaN(parsedDate) ? formatDateToDDMMYYYY(parsedDate) : '';
                            console.log(`Fila ${i + 2}: fechaIngreso (string) procesada: ${fechaIngreso}`);
                        } else if (row.fechaIngreso instanceof Date && !isNaN(row.fechaIngreso)) {
                            fechaIngreso = formatDateToDDMMYYYY(row.fechaIngreso);
                            console.log(`Fila ${i + 2}: fechaIngreso (Date) procesada: ${fechaIngreso}`);
                        }
                    }
                    if (row.fechaFactura) {
                        if (typeof row.fechaFactura === 'number') {
                            const date = excelSerialToDate(row.fechaFactura);
                            fechaFactura = date && !isNaN(date) ? formatDateToDDMMYYYY(date) : '';
                            console.log(`Fila ${i + 2}: fechaFactura (serial: ${row.fechaFactura}) procesada: ${fechaFactura}`);
                        } else if (typeof row.fechaFactura === 'string') {
                            const parsedDate = parseDateDDMMYYYY(row.fechaFactura.replace(/[\/.]/g, '-'));
                            fechaFactura = parsedDate && !isNaN(parsedDate) ? formatDateToDDMMYYYY(parsedDate) : '';
                            console.log(`Fila ${i + 2}: fechaFactura (string) procesada: ${fechaFactura}`);
                        } else if (row.fechaFactura instanceof Date && !isNaN(row.fechaFactura)) {
                            fechaFactura = formatDateToDDMMYYYY(row.fechaFactura);
                            console.log(`Fila ${i + 2}: fechaFactura (Date) procesada: ${fechaFactura}`);
                        }
                    }
                    if (row.fechaOc) {
                        if (typeof row.fechaOc === 'number') {
                            const date = excelSerialToDate(row.fechaOc);
                            fechaOc = date && !isNaN(date) ? formatDateToDDMMYYYY(date) : '';
                            console.log(`Fila ${i + 2}: fechaOc (serial: ${row.fechaOc}) procesada: ${fechaOc}`);
                        } else if (typeof row.fechaOc === 'string') {
                            const parsedDate = parseDateDDMMYYYY(row.fechaOc.replace(/[\/.]/g, '-'));
                            fechaOc = parsedDate && !isNaN(parsedDate) ? formatDateToDDMMYYYY(parsedDate) : '';
                            console.log(`Fila ${i + 2}: fechaOc (string) procesada: ${fechaOc}`);
                        } else if (row.fechaOc instanceof Date && !isNaN(row.fechaOc)) {
                            fechaOc = formatDateToDDMMYYYY(row.fechaOc);
                            console.log(`Fila ${i + 2}: fechaOc (Date) procesada: ${fechaOc}`);
                        }
                    }
                    if (row.fechaSalida) {
                        if (typeof row.fechaSalida === 'number') {
                            const date = excelSerialToDate(row.fechaSalida);
                            fechaSalida = date && !isNaN(date) ? formatDateToDDMMYYYY(date) : '';
                            console.log(`Fila ${i + 2}: fechaSalida (serial: ${row.fechaSalida}) procesada: ${fechaSalida}`);
                        } else if (typeof row.fechaSalida === 'string') {
                            const parsedDate = parseDateDDMMYYYY(row.fechaSalida.replace(/[\/.]/g, '-'));
                            fechaSalida = parsedDate && !isNaN(parsedDate) ? formatDateToDDMMYYYY(parsedDate) : '';
                            console.log(`Fila ${i + 2}: fechaSalida (string) procesada: ${fechaSalida}`);
                        } else if (row.fechaSalida instanceof Date && !isNaN(row.fechaSalida)) {
                            fechaSalida = formatDateToDDMMYYYY(row.fechaSalida);
                            console.log(`Fila ${i + 2}: fechaSalida (Date) procesada: ${fechaSalida}`);
                        }
                    }

                    if (!fechaIngreso || isNaN(parseDateDDMMYYYY(fechaIngreso))) {
                        console.log(`Fila ${i + 2}: Fecha de ingreso no válida: ${fechaIngreso} (valor original: ${row.fechaIngreso})`);
                        showToast(`Fila ${i + 2}: Fecha de ingreso no válida: ${row.fechaIngreso}`, 'error');
                        continue;
                    }

                    // Modificado para aceptar números y convertirlos a string, asegurando que no esté vacío
                    const numeroFacturaStr = String(row.numeroFactura).trim();
                    if (!numeroFacturaStr) {
                        console.log(`Fila ${i + 2}: Número de factura no válido: ${row.numeroFactura}`);
                        showToast(`Fila ${i + 2}: Número de factura no válido: ${row.numeroFactura}`, 'error');
                        continue;
                    }

                    const processedRow = {
                        fechaIngreso,
                        numeroFactura: numeroFacturaStr,
                        fechaFactura,
                        monto: String(row.monto || '').replace(/[^\d]/g, ''),
                        oc: String(row.oc || '').trim(),
                        fechaOc,
                        proveedor: String(row.proveedor || '').trim(),
                        acta: String(row.acta || '').trim(),
                        fechaSalida,
                        salida: String(row.salida || '').trim(),
                        fullName: String(row.fullName || window.currentUserData.fullName || 'Usuario Invitado')
                    };

                    const existing = await getIngresoByUniqueKey(processedRow.numeroFactura);
                    if (existing) {
                        console.log(`Fila ${i + 2}: Número de factura ${processedRow.numeroFactura} ya existe, actualizando...`);
                        await updateDoc(doc(db, "ingresos_lab", existing.id), {
                            ...processedRow,
                            createdAt: new Date()
                        });
                        await logAction(existing.id, 'update', existing, processedRow);
                        updatedCount++;
                    } else {
                        const docRef = await addDoc(collection(db, "ingresos_lab"), {
                            ...processedRow,
                            createdAt: new Date()
                        });
                        await logAction(docRef.id, 'create', null, processedRow);
                        addedCount++;
                    }

                    showImportProgress(((i + 1) / totalRows) * 100);
                }

                hideImportProgress();
                showToast(`Importación completada: ${addedCount} ingresos añadidos, ${updatedCount} actualizados.`, 'success');
                await loadIngresos();
            };
            reader.readAsArrayBuffer(file);
        } catch (error) {
            hideImportProgress();
            showToast('Error al importar el archivo Excel: ' + error.message, 'error');
            console.error('Error en importFromExcel:', error);
        }
    }
});