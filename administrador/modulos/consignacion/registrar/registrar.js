const { initializeApp, getAuth, onAuthStateChanged, setPersistence, browserSessionPersistence } = window.firebaseModules;
const { getFirestore, collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, orderBy, getDoc, limit, startAfter, endBefore } = window.firebaseModules;

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

let registros = [];
let medicos = [];
let currentPage = 1;
const PAGE_SIZE = 10;
let searchAdmision = '';
let searchPaciente = '';
let searchMedico = '';
let searchDescripcion = '';
let searchProveedor = '';
let dateType = 'day';
let fechaDia = '';
let fechaDesde = '';
let fechaHasta = '';
let mesSelect = '';
let anioSelect = '';
let lastDoc = null;
let firstDoc = null;

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('editForm');
    const registrarBtn = document.getElementById('registrarBtn');
    const loading = document.getElementById('registrar-loading');
    const toastContainer = document.getElementById('registrar-toast-container');
    const registrarBody = document.getElementById('registrarBody');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const pageNumbers = document.getElementById('pageNumbers');
    const paginationInfo = document.getElementById('paginationInfo');
    const buscarAdmisionInput = document.getElementById('buscarAdmision');
    const buscarPacienteInput = document.getElementById('buscarPaciente');
    const buscarDescripcionInput = document.getElementById('buscarDescripcion');
    const buscarProveedorInput = document.getElementById('buscarProveedor');
    const buscarMedicoInput = document.getElementById('buscarMedico');
    const fechaDiaInput = document.getElementById('fechaDia');
    const fechaDesdeInput = document.getElementById('fechaDesde');
    const fechaHastaInput = document.getElementById('fechaHasta');
    const mesSelectInput = document.getElementById('mesSelect');
    const anioSelectInput = document.getElementById('anioSelect');
    const dateTypeRadios = document.getElementsByName('dateType');
    const dateDayDiv = document.getElementById('dateDay');
    const dateWeekDiv = document.getElementById('dateWeek');
    const dateMonthDiv = document.getElementById('dateMonth');
    const editModal = document.getElementById('editModal');
    const deleteModal = document.getElementById('deleteModal');
    const historyModal = document.getElementById('historyModal');
    const closeEditSpan = document.getElementById('closeEditModal');
    const cancelEdit = document.getElementById('cancelEdit');
    const closeDeleteSpan = document.getElementById('closeDeleteModal');
    const cancelDelete = document.getElementById('cancelDelete');
    const confirmDelete = document.getElementById('confirmDelete');
    const deleteText = document.getElementById('deleteText');
    const closeHistorySpan = document.getElementById('closeHistory');
    const closeHistoryBtn = document.getElementById('closeHistoryBtn');
    const historyTitle = document.getElementById('historyTitle');
    const historyContent = document.getElementById('historyContent');
    const actionsBtn = document.getElementById('actionsBtn');
    const actionsMenu = document.getElementById('actionsMenu');
    const downloadAll = document.getElementById('downloadAll');
    const downloadPage = document.getElementById('downloadPage');
    const medicoInput = document.getElementById('medico');
    const medicoListBtn = document.getElementById('medicoListBtn');
    const medicoDropdown = document.getElementById('medicoDropdown');
    const editMedicoInput = document.getElementById('editMedico');
    const editMedicoListBtn = document.getElementById('editMedicoListBtn');
    const editMedicoDropdown = document.getElementById('editMedicoDropdown');

    let currentEditId = null;
    let currentDeleteId = null;
    let currentDeleteAdmision = null;

    window.showLoading = function() {
        if (loading) loading.classList.add('show');
    };

    window.hideLoading = function() {
        if (loading) loading.classList.remove('show');
    };

    function showToast(text, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `registrar-toast ${type}`;
        toast.textContent = text;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => {
                    toast.remove();
                }, 300);
            }, 5000);
        }, 100);
    }

    async function loadMedicos() {
        try {
            const querySnapshot = await getDocs(collection(db, "medicos"));
            medicos = [];
            querySnapshot.forEach((doc) => {
                medicos.push({ id: doc.id, nombre: doc.data().nombre, especialidad: doc.data().especialidad || '' });
            });
            medicos.sort((a, b) => a.nombre.localeCompare(b.nombre));
        } catch (error) {
            showToast('Error al cargar médicos: ' + error.message, 'error');
        }
    }

    function showMedicoDropdown(input, dropdown, filter = '') {
        dropdown.innerHTML = '';
        const filteredMedicos = filter
            ? medicos.filter(m => m.nombre.toLowerCase().includes(filter.toLowerCase()))
            : medicos;
        if (filteredMedicos.length === 0) {
            dropdown.style.display = 'none';
            return;
        }
        filteredMedicos.forEach(medico => {
            const option = document.createElement('div');
            option.textContent = medico.nombre;
            option.addEventListener('click', () => {
                input.value = medico.nombre;
                dropdown.style.display = 'none';
            });
            dropdown.appendChild(option);
        });
        dropdown.style.display = 'block';
    }

    function setupMedicoAutocomplete(input, listBtn, dropdown) {
        input.addEventListener('input', () => {
            const value = input.value.trim();
            showMedicoDropdown(input, dropdown, value);
        });
        input.addEventListener('focus', () => {
            showMedicoDropdown(input, dropdown, input.value.trim());
        });
        listBtn.addEventListener('click', () => {
            showMedicoDropdown(input, dropdown);
        });
        window.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !dropdown.contains(e.target) && !listBtn.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    }

    async function logAction(registroId, action, oldData = null, newData = null) {
        if (!window.currentUserData) {
            console.warn('Datos del usuario no disponibles para log');
            return;
        }
        await addDoc(collection(db, "registrar_consignacion_historial"), {
            registroId,
            action,
            timestamp: new Date(),
            userId: auth.currentUser ? auth.currentUser.uid : null,
            userFullName: window.currentUserData.fullName || 'Usuario Invitado',
            username: window.currentUserData.username || 'invitado',
            oldData,
            newData
        });
    }

    async function isDuplicate(admision, excludeId = null) {
        const admisionQuery = query(collection(db, "registrar_consignacion"), where("admision", "==", admision.trim()));
        const querySnapshot = await getDocs(admisionQuery);
        return querySnapshot.docs.some(doc => doc.id !== excludeId);
    }

    function openEditModal(id, data) {
        currentEditId = id;
        document.getElementById('editAdmision').value = data.admision;
        document.getElementById('editPaciente').value = data.paciente;
        document.getElementById('editMedico').value = data.medico;
        document.getElementById('editFechaCX').value = data.fechaCX;
        document.getElementById('editCodigo').value = data.codigo;
        document.getElementById('editDescripcion').value = data.descripcion;
        document.getElementById('editCantidad').value = data.cantidad;
        document.getElementById('editReferencia').value = data.referencia || '';
        document.getElementById('editProveedor').value = data.proveedor || '';
        document.getElementById('editPrecioUnitario').value = data.precioUnitario || '';
        document.getElementById('editAtributo').value = data.atributo || '';
        document.getElementById('editTotalItems').value = data.totalItems || '';
        editModal.style.display = 'block';
    }

    function closeEditModalHandler() {
        editModal.style.display = 'none';
        currentEditId = null;
        form.reset();
    }

    function openDeleteModal(id, admision) {
        currentDeleteId = id;
        currentDeleteAdmision = admision;
        deleteText.textContent = `¿Desea eliminar el registro con admisión "${admision}"?`;
        deleteModal.style.display = 'block';
    }

    function closeDeleteModalHandler() {
        deleteModal.style.display = 'none';
        currentDeleteId = null;
        currentDeleteAdmision = null;
    }

    function openHistoryModal(id, admision) {
        historyTitle.textContent = `Historial Registro ${admision}`;
        showLoading();
        const q = query(collection(db, "registrar_consignacion_historial"), where("registroId", "==", id), orderBy("timestamp", "desc"));
        getDocs(q).then((querySnapshot) => {
            hideLoading();
            let html = '';
            querySnapshot.forEach((doc) => {
                const log = doc.data();
                const date = log.timestamp ? log.timestamp.toDate().toLocaleString('es-CL') : 'Fecha inválida';
                if (log.action === 'create') {
                    html += `<div class="history-entry">Creado | ${log.userFullName || 'Desconocido'} | ${log.username || 'desconocido'} | ${date}</div>`;
                } else if (log.action === 'update') {
                    html += `<div class="history-entry">Modificado | ${log.userFullName || 'Desconocido'} | ${log.username || 'desconocido'} | ${date} | Modificado de ${log.oldData ? log.oldData.admision : 'N/A'} a ${log.newData ? log.newData.admision : 'N/A'}</div>`;
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
    }

    function closeHistoryModalHandler() {
        historyModal.style.display = 'none';
        historyContent.innerHTML = '';
    }

    closeEditSpan.addEventListener('click', closeEditModalHandler);
    cancelEdit.addEventListener('click', closeEditModalHandler);
    window.addEventListener('click', (e) => {
        if (e.target === editModal) closeEditModalHandler();
    });

    closeDeleteSpan.addEventListener('click', closeDeleteModalHandler);
    cancelDelete.addEventListener('click', closeDeleteModalHandler);
    window.addEventListener('click', (e) => {
        if (e.target === deleteModal) closeDeleteModalHandler();
    });

    closeHistorySpan.addEventListener('click', closeHistoryModalHandler);
    closeHistoryBtn.addEventListener('click', closeHistoryModalHandler);
    window.addEventListener('click', (e) => {
        if (e.target === historyModal) closeHistoryModalHandler();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentEditId) return;

        const admision = document.getElementById('editAdmision').value.trim();
        const paciente = document.getElementById('editPaciente').value.trim();
        const medico = document.getElementById('editMedico').value.trim();
        const fechaCX = document.getElementById('editFechaCX').value;
        const codigo = document.getElementById('editCodigo').value.trim();
        const descripcion = document.getElementById('editDescripcion').value.trim();
        const cantidad = document.getElementById('editCantidad').value;

        if (admision && paciente && medico && fechaCX && codigo && descripcion && cantidad) {
            showLoading();
            try {
                const admisionExists = await isDuplicate(admision, currentEditId);
                if (admisionExists) {
                    hideLoading();
                    showToast('El número de admisión ya existe.', 'error');
                    return;
                }

                const oldData = registros.find(r => r.id === currentEditId);
                const newData = {
                    admision,
                    paciente,
                    medico,
                    fechaCX,
                    codigo,
                    descripcion,
                    cantidad: parseInt(cantidad),
                    referencia: document.getElementById('editReferencia').value || null,
                    proveedor: document.getElementById('editProveedor').value || null,
                    precioUnitario: document.getElementById('editPrecioUnitario').value || null,
                    atributo: document.getElementById('editAtributo').value || null,
                    totalItems: document.getElementById('editTotalItems').value || null
                };
                await updateDoc(doc(db, "registrar_consignacion", currentEditId), {
                    ...newData,
                    updatedAt: new Date()
                });
                await logAction(currentEditId, 'update', oldData, newData);
                hideLoading();
                showToast('Registro editado con éxito.', 'success');
                closeEditModalHandler();
                await loadRegistros();
            } catch (error) {
                hideLoading();
                showToast('Error al editar el registro: ' + error.message, 'error');
            }
        } else {
            showToast('Por favor, completa todos los campos obligatorios.', 'error');
        }
    });

    confirmDelete.addEventListener('click', async () => {
        if (!currentDeleteId || !currentDeleteAdmision) return;

        showLoading();
        try {
            const registro = registros.find(r => r.id === currentDeleteId);
            await deleteDoc(doc(db, "registrar_consignacion", currentDeleteId));
            await logAction(currentDeleteId, 'delete', registro);
            hideLoading();
            showToast(`Registro con admisión ${currentDeleteAdmision} eliminado con éxito.`, 'success');
            closeDeleteModalHandler();
            await loadRegistros();
        } catch (error) {
            hideLoading();
            showToast('Error al eliminar el registro: ' + error.message, 'error');
        }
    });

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.replace('../../../index.html');
            return;
        }
        try {
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                window.currentUserData = userDoc.data();
            } else {
                window.currentUserData = { fullName: 'Usuario Invitado', username: 'invitado' };
            }
            await loadMedicos();
            await loadRegistros();
            setupMedicoAutocomplete(medicoInput, medicoListBtn, medicoDropdown);
            setupMedicoAutocomplete(editMedicoInput, editMedicoListBtn, editMedicoDropdown);
        } catch (error) {
            showToast('Error al cargar datos del usuario: ' + error.message, 'error');
        }
    });

    registrarBtn.addEventListener('click', async () => {
        const admision = document.getElementById('admision').value.trim();
        const paciente = document.getElementById('paciente').value.trim();
        const medico = document.getElementById('medico').value.trim();
        const fechaCX = document.getElementById('fechaCX').value;
        const codigo = document.getElementById('codigo').value.trim();
        const descripcion = document.getElementById('descripcion').value.trim();
        const cantidad = document.getElementById('cantidad').value;

        if (admision && paciente && medico && fechaCX && codigo && descripcion && cantidad) {
            showLoading();
            try {
                const admisionExists = await isDuplicate(admision);
                if (admisionExists) {
                    hideLoading();
                    showToast('El número de admisión ya existe.', 'error');
                    return;
                }

                const docRef = await addDoc(collection(db, "registrar_consignacion"), {
                    admision,
                    paciente,
                    medico,
                    fechaCX,
                    codigo,
                    descripcion,
                    cantidad: parseInt(cantidad),
                    referencia: null,
                    proveedor: null,
                    precioUnitario: null,
                    atributo: null,
                    totalItems: null,
                    createdAt: new Date()
                });
                await logAction(docRef.id, 'create', null, { admision, paciente, medico, fechaCX, codigo, descripcion, cantidad });
                hideLoading();
                showToast('Registro creado con éxito.', 'success');
                document.getElementById('admision').value = '';
                document.getElementById('paciente').value = '';
                document.getElementById('medico').value = '';
                document.getElementById('fechaCX').value = '';
                document.getElementById('codigo').value = '';
                document.getElementById('descripcion').value = '';
                document.getElementById('cantidad').value = '';
                await loadRegistros();
            } catch (error) {
                hideLoading();
                showToast('Error al registrar: ' + error.message, 'error');
            }
        } else {
            showToast('Por favor, completa todos los campos obligatorios.', 'error');
        }
    });

    if (buscarAdmisionInput) {
        buscarAdmisionInput.addEventListener('input', (e) => {
            searchAdmision = e.target.value.trim();
            currentPage = 1;
            loadRegistros();
        });
    }

    if (buscarPacienteInput) {
        buscarPacienteInput.addEventListener('input', (e) => {
            searchPaciente = e.target.value.trim();
            currentPage = 1;
            loadRegistros();
        });
    }

    if (buscarDescripcionInput) {
        buscarDescripcionInput.addEventListener('input', (e) => {
            searchDescripcion = e.target.value.trim();
            currentPage = 1;
            loadRegistros();
        });
    }

    if (buscarProveedorInput) {
        buscarProveedorInput.addEventListener('input', (e) => {
            searchProveedor = e.target.value.trim();
            currentPage = 1;
            loadRegistros();
        });
    }

    if (buscarMedicoInput) {
        buscarMedicoInput.addEventListener('input', (e) => {
            searchMedico = e.target.value.trim();
            currentPage = 1;
            loadRegistros();
        });
    }

    if (fechaDiaInput) {
        fechaDiaInput.addEventListener('input', (e) => {
            fechaDia = e.target.value;
            currentPage = 1;
            loadRegistros();
        });
    }

    if (fechaDesdeInput) {
        fechaDesdeInput.addEventListener('input', (e) => {
            fechaDesde = e.target.value;
            currentPage = 1;
            loadRegistros();
        });
    }

    if (fechaHastaInput) {
        fechaHastaInput.addEventListener('input', (e) => {
            fechaHasta = e.target.value;
            currentPage = 1;
            loadRegistros();
        });
    }

    if (mesSelectInput) {
        mesSelectInput.addEventListener('change', (e) => {
            mesSelect = e.target.value;
            currentPage = 1;
            loadRegistros();
        });
    }

    if (anioSelectInput) {
        anioSelectInput.addEventListener('input', (e) => {
            anioSelect = e.target.value;
            currentPage = 1;
            loadRegistros();
        });
    }

    if (dateTypeRadios) {
        dateTypeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                dateType = e.target.value;
                dateDayDiv.style.display = dateType === 'day' ? 'flex' : 'none';
                dateWeekDiv.style.display = dateType === 'week' ? 'flex' : 'none';
                dateMonthDiv.style.display = dateType === 'month' ? 'flex' : 'none';
                currentPage = 1;
                loadRegistros();
            });
        });
    }

    async function loadRegistros() {
        showLoading();
        try {
            let q = query(collection(db, "registrar_consignacion"), orderBy("createdAt", "desc"));
            if (searchAdmision) q = query(q, where("admision", ">=", searchAdmision), where("admision", "<=", searchAdmision + '\uf8ff'));
            if (searchPaciente) q = query(q, where("paciente", ">=", searchPaciente), where("paciente", "<=", searchPaciente + '\uf8ff'));
            if (searchMedico) q = query(q, where("medico", ">=", searchMedico), where("medico", "<=", searchMedico + '\uf8ff'));
            if (searchDescripcion) q = query(q, where("descripcion", ">=", searchDescripcion), where("descripcion", "<=", searchDescripcion + '\uf8ff'));
            if (searchProveedor && searchProveedor !== 'null') q = query(q, where("proveedor", ">=", searchProveedor), where("proveedor", "<=", searchProveedor + '\uf8ff'));
            if (dateType === 'day' && fechaDia) {
                const start = new Date(fechaDia);
                const end = new Date(fechaDia);
                end.setDate(end.getDate() + 1);
                q = query(q, where("fechaCX", ">=", start.toISOString().split('T')[0]), where("fechaCX", "<", end.toISOString().split('T')[0]));
            }
            if (dateType === 'week' && fechaDesde && fechaHasta) {
                q = query(q, where("fechaCX", ">=", fechaDesde), where("fechaCX", "<=", fechaHasta));
            }
            if (dateType === 'month' && mesSelect && anioSelect) {
                const start = new Date(`${anioSelect}-${mesSelect}-01`);
                const end = new Date(start);
                end.setMonth(end.getMonth() + 1);
                q = query(q, where("fechaCX", ">=", start.toISOString().split('T')[0]), where("fechaCX", "<", end.toISOString().split('T')[0]));
            }

            const querySnapshot = await getDocs(q);
            registros = [];
            querySnapshot.forEach((doc) => {
                registros.push({ id: doc.id, ...doc.data() });
            });

            renderTable();
            hideLoading();
        } catch (error) {
            hideLoading();
            showToast('Error al cargar los registros: ' + error.message, 'error');
        }
    }

    function renderTable() {
        const start = (currentPage - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const pageRegistros = registros.slice(start, end);

        if (registrarBody) {
            registrarBody.innerHTML = '';
            pageRegistros.forEach(registro => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="registrar-actions">
                        <button title="Editar" class="registrar-btn-edit" onclick="openEditModal('${registro.id}', ${JSON.stringify(registro)})"><i class="fas fa-edit"></i></button>
                        <button title="Eliminar" class="registrar-btn-delete" onclick="openDeleteModal('${registro.id}', '${registro.admision}')"><i class="fas fa-trash"></i></button>
                        <button title="Ver Historial" class="registrar-btn-history" onclick="openHistoryModal('${registro.id}', '${registro.admision}')"><i class="fas fa-history"></i></button>
                    </td>
                    <td>${registro.admision}</td>
                    <td>${registro.paciente}</td>
                    <td>${registro.medico}</td>
                    <td>${registro.fechaCX}</td>
                    <td>${registro.codigo}</td>
                    <td>${registro.descripcion}</td>
                    <td>${registro.cantidad}</td>
                    <td>${registro.referencia || ''}</td>
                    <td>${registro.proveedor || ''}</td>
                    <td>${registro.precioUnitario || ''}</td>
                    <td>${registro.atributo || ''}</td>
                    <td>${registro.totalItems || ''}</td>
                `;
                registrarBody.appendChild(row);
            });
        }

        updatePagination(registros.length);
    }

    function updatePagination(total) {
        const totalPages = Math.ceil(total / PAGE_SIZE);
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, startPage + 4);

        const startRecord = (currentPage - 1) * PAGE_SIZE + 1;
        const endRecord = Math.min(currentPage * PAGE_SIZE, total);
        const recordsThisPage = endRecord - startRecord + 1;
        if (paginationInfo) paginationInfo.textContent = `Página ${currentPage} de ${totalPages} | ${recordsThisPage} registros en esta página de ${total}`;

        if (prevBtn) prevBtn.disabled = currentPage === 1;
        if (nextBtn) nextBtn.disabled = currentPage === totalPages;

        if (pageNumbers) {
            pageNumbers.innerHTML = '';
            for (let i = startPage; i <= endPage; i++) {
                if (i > startPage && i <= endPage - 1 && endPage - startPage > 3) {
                    const dots = document.createElement('span');
                    dots.textContent = '...';
                    dots.className = 'registrar-dots';
                    pageNumbers.appendChild(dots);
                    continue;
                }
                const btn = document.createElement('button');
                btn.textContent = i;
                btn.className = i === currentPage ? 'active' : '';
                btn.addEventListener('click', () => goToPage(i));
                pageNumbers.appendChild(btn);
            }
        }
    }

    function goToPage(page) {
        currentPage = page;
        renderTable();
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                loadRegistros();
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(registros.length / PAGE_SIZE);
            if (currentPage < totalPages) {
                currentPage++;
                loadRegistros();
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

    downloadAll.addEventListener('click', (e) => {
        e.preventDefault();
        exportToExcel(registros.map(r => ({
            Admisión: r.admision,
            Paciente: r.paciente,
            Médico: r.medico,
            'Fecha CX': r.fechaCX,
            Código: r.codigo,
            Descripción: r.descripcion,
            Cantidad: r.cantidad,
            Referencia: r.referencia || '',
            Proveedor: r.proveedor || '',
            'Precio Unitario': r.precioUnitario || '',
            Atributo: r.atributo || '',
            'Total Items': r.totalItems || ''
        })), 'todos_registros');
        actionsMenu.style.display = 'none';
    });

    downloadPage.addEventListener('click', (e) => {
        e.preventDefault();
        const start = (currentPage - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const pageData = registros.slice(start, end).map(r => ({
            Admisión: r.admision,
            Paciente: r.paciente,
            Médico: r.medico,
            'Fecha CX': r.fechaCX,
            Código: r.codigo,
            Descripción: r.descripcion,
            Cantidad: r.cantidad,
            Referencia: r.referencia || '',
            Proveedor: r.proveedor || '',
            'Precio Unitario': r.precioUnitario || '',
            Atributo: r.atributo || '',
            'Total Items': r.totalItems || ''
        }));
        exportToExcel(pageData, 'pagina_actual_registros');
        actionsMenu.style.display = 'none';
    });

    function exportToExcel(data, filename) {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Registros");
        XLSX.writeFile(wb, filename + '.xlsx');
    }

    window.openEditModal = openEditModal;
    window.openDeleteModal = openDeleteModal;
    window.openHistoryModal = openHistoryModal;
});