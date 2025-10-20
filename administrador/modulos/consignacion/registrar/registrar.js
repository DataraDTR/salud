const { initializeApp, getAuth, onAuthStateChanged, setPersistence, browserSessionPersistence, getFirestore, collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, orderBy, getDoc, limit, startAfter, endBefore } = window.firebaseModules;

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
const PAGE_SIZE = 50;
let lastVisible = null;
let firstVisible = null;
let totalRecords = 0;
let searchAdmision = '';
let searchPaciente = '';
let searchMedico = '';
let searchDescripcion = '';
let searchProveedor = '';
let dateFilter = null;
let fechaDia = null;
let fechaDesde = null;
let fechaHasta = null;
let mes = null;
let anio = null;

function formatNumberWithThousandsSeparator(number) {
    if (!number) return '';
    const cleaned = String(number).replace(/[^\d]/g, '');
    return cleaned ? Number(cleaned).toLocaleString('es-CL') : '';
}

async function loadMedicos() {
    try {
        const querySnapshot = await getDocs(collection(db, "medicos"));
        medicos = [];
        querySnapshot.forEach((doc) => {
            medicos.push({ id: doc.id, ...doc.data() });
        });
        medicos.sort((a, b) => a.nombre.localeCompare(b.nombre));
    } catch (error) {
        showToast('Error al cargar médicos: ' + error.message, 'error');
    }
}

function setupAutocomplete(inputId, iconId, listId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    const list = document.getElementById(listId);

    function showSuggestions(value) {
        list.innerHTML = '';
        if (!value) {
            list.classList.remove('show');
            return;
        }
        const filtered = medicos.filter(m => m.nombre.toLowerCase().includes(value.toLowerCase()));
        if (filtered.length === 0) {
            list.classList.remove('show');
            return;
        }
        filtered.forEach(medico => {
            const div = document.createElement('div');
            div.textContent = medico.nombre;
            div.addEventListener('click', () => {
                input.value = medico.nombre;
                list.innerHTML = '';
                list.classList.remove('show');
            });
            list.appendChild(div);
        });
        list.classList.add('show');
    }

    function showAllMedicos() {
        list.innerHTML = '';
        medicos.forEach(medico => {
            const div = document.createElement('div');
            div.textContent = medico.nombre;
            div.addEventListener('click', () => {
                input.value = medico.nombre;
                list.innerHTML = '';
                list.classList.remove('show');
            });
            list.appendChild(div);
        });
        list.classList.add('show');
    }

    input.addEventListener('input', (e) => {
        showSuggestions(e.target.value);
    });

    input.addEventListener('blur', () => {
        setTimeout(() => {
            list.classList.remove('show');
        }, 200);
    });

    icon.addEventListener('click', () => {
        if (list.classList.contains('show')) {
            list.classList.remove('show');
        } else {
            showAllMedicos();
        }
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !icon.contains(e.target) && !list.contains(e.target)) {
            list.classList.remove('show');
        }
    });
}

async function logAction(registroId, action, oldData = null, newData = null) {
    if (!window.currentUserData) return;
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

function setupColumnResize() {
    const table = document.querySelector('.registrar-table');
    const headers = document.querySelectorAll('.registrar-table th');

    const initialWidths = [
        100, // Admisión
        130, // Paciente
        200, // Médico
        120, // Fecha CX
        100, // Código
        300, // Descripción
        80,  // Cantidad
        130, // Referencia
        150, // Proveedor
        100, // Precio Unitario
        120, // Atributo
        100, // Total Items
        100  // Acciones
    ];

    headers.forEach((header, index) => {
        header.style.width = `${initialWidths[index]}px`;
        header.style.minWidth = `${initialWidths[index]}px`;
        header.style.maxWidth = `${initialWidths[index]}px`;
        const cells = document.querySelectorAll(`.registrar-table td:nth-child(${index + 1})`);
        cells.forEach(cell => {
            cell.style.width = `${initialWidths[index]}px`;
            cell.style.minWidth = `${initialWidths[index]}px`;
            cell.style.maxWidth = `${initialWidths[index]}px`;
        });
    });

    headers.forEach((header, index) => {
        const existingHandle = header.querySelector('.resize-handle');
        if (existingHandle) existingHandle.remove();

        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        header.appendChild(resizeHandle);
        header.style.position = 'relative';

        let isResizing = false;
        let startX, startWidth;

        const startResize = (e) => {
            isResizing = true;
            startX = e.pageX || (e.touches && e.touches[0].pageX);
            startWidth = parseFloat(getComputedStyle(header).width);
            resizeHandle.classList.add('active');
            e.preventDefault();
        };

        const resize = (e) => {
            if (!isResizing) return;
            const clientX = e.pageX || (e.touches && e.touches[0].pageX);
            if (!clientX) return;

            const newWidth = Math.max(20, Math.min(2000, startWidth + (clientX - startX)));

            header.style.width = `${newWidth}px`;
            header.style.minWidth = `${newWidth}px`;
            header.style.maxWidth = `${newWidth}px`;

            const cells = document.querySelectorAll(`.registrar-table td:nth-child(${index + 1})`);
            cells.forEach(cell => {
                cell.style.width = `${newWidth}px`;
                cell.style.minWidth = `${newWidth}px`;
                cell.style.maxWidth = `${newWidth}px`;
            });

            e.preventDefault();
        };

        const stopResize = () => {
            if (isResizing) {
                isResizing = false;
                resizeHandle.classList.remove('active');
            }
        };

        resizeHandle.addEventListener('mousedown', startResize);
        resizeHandle.addEventListener('touchstart', startResize, { passive: false });
        document.addEventListener('mousemove', resize);
        document.addEventListener('touchmove', resize, { passive: false });
        document.addEventListener('mouseup', stopResize);
        document.addEventListener('touchend', stopResize);
    });
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function showToast(text, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `registrar-toast ${type}`;
    toast.textContent = text;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 5000);
}

async function validateAdmision(admision, excludeId = null) {
    if (!admision) return null;
    const q = query(collection(db, "registrar_consignacion"), where("admision", "==", admision.trim().toUpperCase()));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        if (excludeId && doc.id === excludeId) return null;
        return { id: doc.id, ...doc.data() };
    }
    return null;
}

async function getProductoByCodigo(codigo) {
    if (!codigo) return null;
    const q = query(collection(db, "productos"), where("codigo", "==", codigo.trim().toUpperCase()));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    }
    return null;
}

document.addEventListener('DOMContentLoaded', () => {
    const loading = document.getElementById('loading');
    const registrarTable = document.getElementById('registrarTable');
    const registrarBody = registrarTable.querySelector('tbody');
    const prevPage = document.getElementById('prevPage');
    const nextPage = document.getElementById('nextPage');
    const pageNumbers = document.getElementById('pageNumbers');
    const paginationInfo = document.getElementById('paginationInfo');
    const registrarBtn = document.getElementById('registrarBtn');
    const limpiarBtn = document.getElementById('limpiarBtn');
    const admisionInput = document.getElementById('admision');
    const pacienteInput = document.getElementById('paciente');
    const medicoInput = document.getElementById('medico');
    const fechaCXInput = document.getElementById('fechaCX');
    const codigoInput = document.getElementById('codigo');
    const descripcionInput = document.getElementById('descripcion');
    const cantidadInput = document.getElementById('cantidad');
    const referenciaInput = document.getElementById('referencia');
    const proveedorInput = document.getElementById('proveedor');
    const precioUnitarioInput = document.getElementById('precioUnitario');
    const atributoInput = document.getElementById('atributo');
    const totalItemsInput = document.getElementById('totalItems');
    const buscarAdmisionInput = document.getElementById('buscarAdmision');
    const buscarPacienteInput = document.getElementById('buscarPaciente');
    const buscarMedicoInput = document.getElementById('buscarMedico');
    const buscarDescripcionInput = document.getElementById('buscarDescripcion');
    const buscarProveedorInput = document.getElementById('buscarProveedor');
    const dateDay = document.getElementById('dateDay');
    const dateWeek = document.getElementById('dateWeek');
    const dateMonth = document.getElementById('dateMonth');
    const fechaDiaInput = document.getElementById('fechaDia');
    const fechaDesdeInput = document.getElementById('fechaDesde');
    const fechaHastaInput = document.getElementById('fechaHasta');
    const mesSelect = document.getElementById('mesSelect');
    const anioSelect = document.getElementById('anioSelect');
    const actionsBtn = document.getElementById('actionsBtn');
    const actionsMenu = document.getElementById('actionsMenu');
    const downloadAll = document.getElementById('downloadAll');
    const downloadCurrent = document.getElementById('downloadCurrent');
    const editModal = document.getElementById('editModal');
    const deleteModal = document.getElementById('deleteModal');
    const historyModal = document.getElementById('historyModal');
    const editAdmisionInput = document.getElementById('editAdmision');
    const editPacienteInput = document.getElementById('editPaciente');
    const editMedicoInput = document.getElementById('editMedico');
    const editFechaCXInput = document.getElementById('editFechaCX');
    const editCodigoInput = document.getElementById('editCodigo');
    const editDescripcionInput = document.getElementById('editDescripcion');
    const editCantidadInput = document.getElementById('editCantidad');
    const editReferenciaInput = document.getElementById('editReferencia');
    const editProveedorInput = document.getElementById('editProveedor');
    const editPrecioUnitarioInput = document.getElementById('editPrecioUnitario');
    const editAtributoInput = document.getElementById('editAtributo');
    const editTotalItemsInput = document.getElementById('editTotalItems');
    const saveEditBtn = document.getElementById('saveEditBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const medicoToggle = document.getElementById('medicoToggle');
    const medicoDropdown = document.getElementById('medicoDropdown');
    const editMedicoToggle = document.getElementById('editMedicoToggle');
    const editMedicoDropdown = document.getElementById('editMedicoDropdown');
    const historyContent = document.getElementById('historyContent');

    let currentEditId = null;
    let currentEditOldData = null;
    let currentDeleteId = null;
    let currentDeleteAdmision = null;

    function formatMontoInput(input) {
        input.addEventListener('input', (e) => {
            const value = e.target.value.replace(/[^\d]/g, '');
            e.target.value = formatNumberWithThousandsSeparator(value);
        });
    }

    formatMontoInput(precioUnitarioInput);
    formatMontoInput(editPrecioUnitarioInput);

    function enforceUpperCase(input) {
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
    }

    [admisionInput, pacienteInput, medicoInput, codigoInput, descripcionInput, referenciaInput, proveedorInput, atributoInput,
        editAdmisionInput, editPacienteInput, editMedicoInput, editCodigoInput, editDescripcionInput, editReferenciaInput, editProveedorInput, editAtributoInput]
        .forEach(input => input && enforceUpperCase(input));

    function clearForm() {
        admisionInput.value = '';
        pacienteInput.value = '';
        medicoInput.value = '';
        fechaCXInput.value = '';
        codigoInput.value = '';
        descripcionInput.value = '';
        cantidadInput.value = '';
        referenciaInput.value = '';
        proveedorInput.value = '';
        precioUnitarioInput.value = '';
        atributoInput.value = '';
        totalItemsInput.value = '';
        medicoDropdown.classList.remove('show');
    }

    window.showLoading = function () {
        if (loading) loading.classList.add('show');
    };

    window.hideLoading = function () {
        if (loading) loading.classList.remove('show');
    };

    function closeModal(modal) {
        modal.style.display = 'none';
        if (modal === editModal) {
            currentEditId = null;
            currentEditOldData = null;
            editMedicoDropdown.classList.remove('show');
        } else if (modal === deleteModal) {
            currentDeleteId = null;
            currentDeleteAdmision = null;
        } else if (modal === historyModal) {
            historyContent.innerHTML = '';
        }
    }

    document.querySelectorAll('.modal .close').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            closeModal(closeBtn.closest('.modal'));
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target);
        }
    });

    cancelEditBtn.addEventListener('click', () => closeModal(editModal));
    cancelDeleteBtn.addEventListener('click', () => closeModal(deleteModal));

    async function loadRegistros() {
        showLoading();
        try {
            let q = query(collection(db, "registrar_consignacion"), orderBy("fechaCX", "desc"));
            const conditions = [];

            if (searchAdmision) {
                conditions.push(where("admision", ">=", searchAdmision));
                conditions.push(where("admision", "<=", searchAdmision + '\uf8ff'));
            }
            if (searchPaciente) {
                conditions.push(where("paciente", ">=", searchPaciente));
                conditions.push(where("paciente", "<=", searchPaciente + '\uf8ff'));
            }
            if (searchMedico) {
                conditions.push(where("medico", ">=", searchMedico));
                conditions.push(where("medico", "<=", searchMedico + '\uf8ff'));
            }
            if (searchProveedor) {
                conditions.push(where("proveedor", ">=", searchProveedor));
                conditions.push(where("proveedor", "<=", searchProveedor + '\uf8ff'));
            }
            if (dateFilter === 'day' && fechaDia) {
                const start = new Date(fechaDia);
                const end = new Date(fechaDia);
                end.setDate(end.getDate() + 1);
                conditions.push(where("fechaCX", ">=", start));
                conditions.push(where("fechaCX", "<", end));
            } else if (dateFilter === 'week' && fechaDesde && fechaHasta) {
                conditions.push(where("fechaCX", ">=", new Date(fechaDesde)));
                conditions.push(where("fechaCX", "<=", new Date(fechaHasta)));
            } else if (dateFilter === 'month' && mes && anio) {
                const start = new Date(anio, mes - 1, 1);
                const end = new Date(anio, mes, 1);
                conditions.push(where("fechaCX", ">=", start));
                conditions.push(where("fechaCX", "<", end));
            }

            if (currentPage > 1 && lastVisible) {
                conditions.push(startAfter(lastVisible));
            }
            conditions.push(limit(PAGE_SIZE));

            q = query(q, ...conditions);

            const querySnapshot = await getDocs(q);
            let tempRegistros = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                data.fechaCX = data.fechaCX ? data.fechaCX.toDate() : null;
                tempRegistros.push({ id: doc.id, ...data });
            });

            if (searchDescripcion) {
                tempRegistros = tempRegistros.filter(reg => 
                    reg.descripcion && reg.descripcion.toUpperCase().includes(searchDescripcion)
                );
            }

            registros = tempRegistros;

            if (querySnapshot.docs.length > 0) {
                lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
                firstVisible = querySnapshot.docs[0];
            } else {
                lastVisible = null;
                firstVisible = null;
            }

            let countQuery = query(collection(db, "registrar_consignacion"));
            if (searchAdmision) {
                countQuery = query(countQuery,
                    where("admision", ">=", searchAdmision),
                    where("admision", "<=", searchAdmision + '\uf8ff')
                );
            } else if (searchPaciente) {
                countQuery = query(countQuery,
                    where("paciente", ">=", searchPaciente),
                    where("paciente", "<=", searchPaciente + '\uf8ff')
                );
            } else if (searchMedico) {
                countQuery = query(countQuery,
                    where("medico", ">=", searchMedico),
                    where("medico", "<=", searchMedico + '\uf8ff')
                );
            } else if (searchProveedor) {
                countQuery = query(countQuery,
                    where("proveedor", ">=", searchProveedor),
                    where("proveedor", "<=", searchProveedor + '\uf8ff')
                );
            } else if (dateFilter === 'day' && fechaDia) {
                const start = new Date(fechaDia);
                const end = new Date(fechaDia);
                end.setDate(end.getDate() + 1);
                countQuery = query(countQuery,
                    where("fechaCX", ">=", start),
                    where("fechaCX", "<", end)
                );
            } else if (dateFilter === 'week' && fechaDesde && fechaHasta) {
                countQuery = query(countQuery,
                    where("fechaCX", ">=", new Date(fechaDesde)),
                    where("fechaCX", "<=", new Date(fechaHasta))
                );
            } else if (dateFilter === 'month' && mes && anio) {
                const start = new Date(anio, mes - 1, 1);
                const end = new Date(anio, mes, 1);
                countQuery = query(countQuery,
                    where("fechaCX", ">=", start),
                    where("fechaCX", "<", end)
                );
            }

            const countSnapshot = await getDocs(countQuery);
            totalRecords = countSnapshot.size;

            if (searchDescripcion) {
                totalRecords = registros.length;
            }

            renderTable();
            hideLoading();
        } catch (error) {
            hideLoading();
            showToast('Error al cargar los registros: ' + error.message, 'error');
        }
    }

    function renderTable() {
        if (registrarBody) {
            registrarBody.innerHTML = '';
            if (registros.length === 0) {
                registrarBody.innerHTML = '<tr><td colspan="13">No hay registros para mostrar.</td></tr>';
            } else {
                registros.forEach(registro => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${registro.admision || ''}</td>
                        <td>${registro.paciente || ''}</td>
                        <td>${registro.medico || ''}</td>
                        <td>${registro.fechaCX ? registro.fechaCX.toLocaleDateString('es-CL') : ''}</td>
                        <td>${registro.codigo || ''}</td>
                        <td>${registro.descripcion || ''}</td>
                        <td>${registro.cantidad || ''}</td>
                        <td>${registro.referencia || ''}</td>
                        <td>${registro.proveedor || ''}</td>
                        <td>${formatNumberWithThousandsSeparator(registro.precioUnitario)}</td>
                        <td>${registro.atributo || ''}</td>
                        <td>${registro.totalItems || ''}</td>
                        <td class="registrar-actions">
                            <button title="Editar" class="registrar-btn-edit" onclick="openEditModal('${registro.id}', ${JSON.stringify(registro).replace(/"/g, '&quot;')})"><i class="fas fa-edit"></i></button>
                            <button title="Eliminar" class="registrar-btn-delete" onclick="openDeleteModal('${registro.id}', '${registro.admision}')"><i class="fas fa-trash"></i></button>
                            <button title="Ver Historial" class="registrar-btn-history" onclick="openHistoryModal('${registro.id}', '${registro.admision}')"><i class="fas fa-history"></i></button>
                        </td>
                    `;
                    registrarBody.appendChild(row);
                });
            }
        }

        updatePagination(totalRecords);
        setupColumnResize();
    }

    function updatePagination(total) {
        const totalPages = Math.ceil(total / PAGE_SIZE);
        const startRecord = (currentPage - 1) * PAGE_SIZE + 1;
        const endRecord = Math.min(currentPage * PAGE_SIZE, total);
        const recordsThisPage = endRecord - startRecord + 1;

        if (paginationInfo) {
            paginationInfo.textContent = `Página ${currentPage} de ${totalPages} | ${recordsThisPage} registros en esta página de ${total}`;
        }

        if (prevPage) prevPage.disabled = currentPage === 1;
        if (nextPage) nextPage.disabled = currentPage === totalPages;

        if (pageNumbers) {
            pageNumbers.innerHTML = '';
            const startPage = Math.max(1, currentPage - 2);
            const endPage = Math.min(totalPages, startPage + 4);

            if (startPage > 1) {
                const btn = document.createElement('button');
                btn.textContent = '1';
                btn.className = 1 === currentPage ? 'active' : '';
                btn.addEventListener('click', () => goToPage(1));
                pageNumbers.appendChild(btn);
                if (startPage > 2) {
                    const dots = document.createElement('span');
                    dots.textContent = '...';
                    dots.className = 'registrar-dots';
                    pageNumbers.appendChild(dots);
                }
            }

            for (let i = startPage; i <= endPage; i++) {
                const btn = document.createElement('button');
                btn.textContent = i;
                btn.className = i === currentPage ? 'active' : '';
                btn.addEventListener('click', () => goToPage(i));
                pageNumbers.appendChild(btn);
            }

            if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                    const dots = document.createElement('span');
                    dots.textContent = '...';
                    dots.className = 'registrar-dots';
                    pageNumbers.appendChild(dots);
                }
                const btn = document.createElement('button');
                btn.textContent = totalPages;
                btn.className = totalPages === currentPage ? 'active' : '';
                btn.addEventListener('click', () => goToPage(totalPages));
                pageNumbers.appendChild(btn);
            }
        }
    }

    function goToPage(page) {
        currentPage = page;
        loadRegistros();
    }

    if (prevPage) {
        prevPage.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                loadRegistros();
            }
        });
    }

    if (nextPage) {
        nextPage.addEventListener('click', () => {
            const totalPages = Math.ceil(totalRecords / PAGE_SIZE);
            if (currentPage < totalPages) {
                currentPage++;
                loadRegistros();
            }
        });
    }

    const debouncedLoadRegistros = debounce(loadRegistros, 300);

    if (buscarAdmisionInput) {
        buscarAdmisionInput.addEventListener('input', (e) => {
            searchAdmision = e.target.value.trim().toUpperCase();
            currentPage = 1;
            lastVisible = null;
            firstVisible = null;
            debouncedLoadRegistros();
        });
    }

    if (buscarPacienteInput) {
        buscarPacienteInput.addEventListener('input', (e) => {
            searchPaciente = e.target.value.trim().toUpperCase();
            currentPage = 1;
            lastVisible = null;
            firstVisible = null;
            debouncedLoadRegistros();
        });
    }

    if (buscarMedicoInput) {
        buscarMedicoInput.addEventListener('input', (e) => {
            searchMedico = e.target.value.trim().toUpperCase();
            currentPage = 1;
            lastVisible = null;
            firstVisible = null;
            debouncedLoadRegistros();
        });
    }

    if (buscarDescripcionInput) {
        buscarDescripcionInput.addEventListener('input', (e) => {
            searchDescripcion = e.target.value.trim().toUpperCase();
            currentPage = 1;
            lastVisible = null;
            firstVisible = null;
            debouncedLoadRegistros();
        });
    }

    if (buscarProveedorInput) {
        buscarProveedorInput.addEventListener('input', (e) => {
            searchProveedor = e.target.value.trim().toUpperCase();
            currentPage = 1;
            lastVisible = null;
            firstVisible = null;
            debouncedLoadRegistros();
        });
    }

    if (dateDay) {
        dateDay.addEventListener('change', (e) => {
            if (e.target.checked) {
                dateFilter = 'day';
                fechaDia = fechaDiaInput.value;
                currentPage = 1;
                lastVisible = null;
                firstVisible = null;
                debouncedLoadRegistros();
            }
        });
    }

    if (dateWeek) {
        dateWeek.addEventListener('change', (e) => {
            if (e.target.checked) {
                dateFilter = 'week';
                fechaDesde = fechaDesdeInput.value;
                fechaHasta = fechaHastaInput.value;
                currentPage = 1;
                lastVisible = null;
                firstVisible = null;
                debouncedLoadRegistros();
            }
        });
    }

    if (dateMonth) {
        dateMonth.addEventListener('change', (e) => {
            if (e.target.checked) {
                dateFilter = 'month';
                mes = mesSelect.value;
                anio = anioSelect.value;
                currentPage = 1;
                lastVisible = null;
                firstVisible = null;
                debouncedLoadRegistros();
            }
        });
    }

    if (fechaDiaInput) {
        fechaDiaInput.addEventListener('change', (e) => {
            if (dateDay.checked) {
                fechaDia = e.target.value;
                currentPage = 1;
                lastVisible = null;
                firstVisible = null;
                debouncedLoadRegistros();
            }
        });
    }

    if (fechaDesdeInput) {
        fechaDesdeInput.addEventListener('change', (e) => {
            if (dateWeek.checked) {
                fechaDesde = e.target.value;
                currentPage = 1;
                lastVisible = null;
                firstVisible = null;
                debouncedLoadRegistros();
            }
        });
    }

    if (fechaHastaInput) {
        fechaHastaInput.addEventListener('change', (e) => {
            if (dateWeek.checked) {
                fechaHasta = e.target.value;
                currentPage = 1;
                lastVisible = null;
                firstVisible = null;
                debouncedLoadRegistros();
            }
        });
    }

    if (mesSelect) {
        mesSelect.addEventListener('change', (e) => {
            if (dateMonth.checked) {
                mes = e.target.value;
                currentPage = 1;
                lastVisible = null;
                firstVisible = null;
                debouncedLoadRegistros();
            }
        });
    }

    if (anioSelect) {
        anioSelect.addEventListener('change', (e) => {
            if (dateMonth.checked) {
                anio = e.target.value;
                currentPage = 1;
                lastVisible = null;
                firstVisible = null;
                debouncedLoadRegistros();
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

    downloadAll.addEventListener('click', async (e) => {
        e.preventDefault();
        showLoading();
        try {
            const q = query(collection(db, "registrar_consignacion"));
            const querySnapshot = await getDocs(q);
            const allRegistros = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                data.fechaCX = data.fechaCX ? data.fechaCX.toDate() : null;
                allRegistros.push({ id: doc.id, ...data });
            });
            const data = allRegistros.map(reg => ({
                Admisión: reg.admision || '',
                Paciente: reg.paciente || '',
                Médico: reg.medico || '',
                'Fecha CX': reg.fechaCX ? reg.fechaCX.toLocaleDateString('es-CL') : '',
                Código: reg.codigo || '',
                Descripción: reg.descripcion || '',
                Cantidad: reg.cantidad || '',
                Referencia: reg.referencia || '',
                Proveedor: reg.proveedor || '',
                'Precio Unitario': reg.precioUnitario ? formatNumberWithThousandsSeparator(reg.precioUnitario) : '',
                Atributo: reg.atributo || '',
                'Total Items': reg.totalItems || ''
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Registros");
            XLSX.writeFile(wb, 'registros_todos.xlsx');
            actionsMenu.style.display = 'none';
            hideLoading();
        } catch (error) {
            hideLoading();
            showToast('Error al descargar los registros: ' + error.message, 'error');
        }
    });

    downloadCurrent.addEventListener('click', (e) => {
        e.preventDefault();
        const data = registros.map(reg => ({
            Admisión: reg.admision || '',
            Paciente: reg.paciente || '',
            Médico: reg.medico || '',
            'Fecha CX': reg.fechaCX ? reg.fechaCX.toLocaleDateString('es-CL') : '',
            Código: reg.codigo || '',
            Descripción: reg.descripcion || '',
            Cantidad: reg.cantidad || '',
            Referencia: reg.referencia || '',
            Proveedor: reg.proveedor || '',
            'Precio Unitario': reg.precioUnitario ? formatNumberWithThousandsSeparator(reg.precioUnitario) : '',
            Atributo: reg.atributo || '',
            'Total Items': reg.totalItems || ''
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Registros");
        XLSX.writeFile(wb, `registros_pagina_${currentPage}.xlsx`);
        actionsMenu.style.display = 'none';
    });

    registrarBtn.addEventListener('click', async () => {
        const registro = {
            admision: admisionInput.value.trim().toUpperCase(),
            paciente: pacienteInput.value.trim().toUpperCase(),
            medico: medicoInput.value.trim(),
            fechaCX: fechaCXInput.value ? new Date(fechaCXInput.value) : null,
            codigo: codigoInput.value.trim().toUpperCase(),
            descripcion: descripcionInput.value.trim().toUpperCase(),
            cantidad: parseInt(cantidadInput.value) || 0,
            referencia: referenciaInput.value.trim().toUpperCase(),
            proveedor: proveedorInput.value.trim().toUpperCase(),
            precioUnitario: parseInt(precioUnitarioInput.value.replace(/[^\d]/g, '')) || 0,
            atributo: atributoInput.value.trim().toUpperCase(),
            totalItems: totalItemsInput.value || '',
            fullName: window.currentUserData.fullName
        };

        if (!registro.admision || !registro.paciente || !registro.medico || !registro.fechaCX || !registro.codigo || !registro.cantidad) {
            showToast('Todos los campos obligatorios deben estar completos.', 'error');
            return;
        }

        showLoading();
        try {
            const existingAdmision = await validateAdmision(registro.admision);
            if (existingAdmision) {
                hideLoading();
                showToast('El número de admisión ya está registrado.', 'error');
                return;
            }

            const producto = await getProductoByCodigo(registro.codigo);
            if (!producto) {
                hideLoading();
                showToast('El código no existe en la base de datos de productos.', 'error');
                return;
            }

            registro.referencia = producto.referencia || '';
            registro.proveedor = producto.proveedor || '';
            registro.precioUnitario = producto.precioUnitario || 0;
            registro.atributo = producto.atributo || '';
            registro.totalItems = (registro.cantidad * registro.precioUnitario).toString();

            const docRef = await addDoc(collection(db, "registrar_consignacion"), {
                ...registro,
                createdAt: new Date()
            });
            await logAction(docRef.id, 'create', null, registro);
            clearForm();
            hideLoading();
            showToast('Registro añadido exitosamente', 'success');
            await loadRegistros();
        } catch (error) {
            hideLoading();
            showToast('Error al añadir el registro: ' + error.message, 'error');
        }
    });

    limpiarBtn.addEventListener('click', clearForm);

    window.openEditModal = function (id, registro) {
        currentEditId = id;
        currentEditOldData = { ...registro };
        editAdmisionInput.value = registro.admision || '';
        editPacienteInput.value = registro.paciente || '';
        editMedicoInput.value = registro.medico || '';
        editFechaCXInput.value = registro.fechaCX ? registro.fechaCX.toISOString().split('T')[0] : '';
        editCodigoInput.value = registro.codigo || '';
        editDescripcionInput.value = registro.descripcion || '';
        editCantidadInput.value = registro.cantidad || '';
        editReferenciaInput.value = registro.referencia || '';
        editProveedorInput.value = registro.proveedor || '';
        editPrecioUnitarioInput.value = registro.precioUnitario ? formatNumberWithThousandsSeparator(registro.precioUnitario) : '';
        editAtributoInput.value = registro.atributo || '';
        editTotalItemsInput.value = registro.totalItems || '';
        editModal.style.display = 'block';
    };

    saveEditBtn.addEventListener('click', async () => {
        if (!currentEditId) return;

        const registro = {
            admision: editAdmisionInput.value.trim().toUpperCase(),
            paciente: editPacienteInput.value.trim().toUpperCase(),
            medico: editMedicoInput.value.trim(),
            fechaCX: editFechaCXInput.value ? new Date(editFechaCXInput.value) : null,
            codigo: editCodigoInput.value.trim().toUpperCase(),
            descripcion: editDescripcionInput.value.trim().toUpperCase(),
            cantidad: parseInt(editCantidadInput.value) || 0,
            referencia: editReferenciaInput.value.trim().toUpperCase(),
            proveedor: editProveedorInput.value.trim().toUpperCase(),
            precioUnitario: parseInt(editPrecioUnitarioInput.value.replace(/[^\d]/g, '')) || 0,
            atributo: editAtributoInput.value.trim().toUpperCase(),
            totalItems: editTotalItemsInput.value || '',
            fullName: window.currentUserData.fullName
        };

        if (!registro.admision || !registro.paciente || !registro.medico || !registro.fechaCX || !registro.codigo || !registro.cantidad) {
            showToast('Todos los campos obligatorios deben estar completos.', 'error');
            return;
        }

        showLoading();
        try {
            const existingAdmision = await validateAdmision(registro.admision, currentEditId);
            if (existingAdmision) {
                hideLoading();
                showToast('El número de admisión ya está registrado.', 'error');
                return;
            }

            const producto = await getProductoByCodigo(registro.codigo);
            if (!producto) {
                hideLoading();
                showToast('El código no existe en la base de datos de productos.', 'error');
                return;
            }

            registro.referencia = producto.referencia || '';
            registro.proveedor = producto.proveedor || '';
            registro.precioUnitario = producto.precioUnitario || 0;
            registro.atributo = producto.atributo || '';
            registro.totalItems = (registro.cantidad * registro.precioUnitario).toString();

            await updateDoc(doc(db, "registrar_consignacion", currentEditId), {
                ...registro,
                updatedAt: new Date()
            });
            await logAction(currentEditId, 'update', currentEditOldData, registro);
            hideLoading();
            showToast('Registro actualizado exitosamente', 'success');
            closeModal(editModal);
            await loadRegistros();
        } catch (error) {
            hideLoading();
            showToast('Error al actualizar el registro: ' + error.message, 'error');
        }
    });

    window.openDeleteModal = function (id, admision) {
        currentDeleteId = id;
        currentDeleteAdmision = admision;
        document.querySelector('#deleteModal .delete-modal-text').textContent = `¿Estás seguro de que deseas eliminar el registro con admisión "${admision}"?`;
        deleteModal.style.display = 'block';
    };

    confirmDeleteBtn.addEventListener('click', async () => {
        if (!currentDeleteId) return;

        showLoading();
        try {
            const registroDoc = await getDoc(doc(db, "registrar_consignacion", currentDeleteId));
            if (registroDoc.exists()) {
                const registroData = registroDoc.data();
                await logAction(currentDeleteId, 'delete', registroData);
                await deleteDoc(doc(db, "registrar_consignacion", currentDeleteId));
                hideLoading();
                showToast(`Registro con admisión ${currentDeleteAdmision} eliminado exitosamente`, 'success');
                closeModal(deleteModal);
                await loadRegistros();
            } else {
                hideLoading();
                showToast('El registro no existe.', 'error');
                closeModal(deleteModal);
            }
        } catch (error) {
            hideLoading();
            showToast('Error al eliminar el registro: ' + error.message, 'error');
        }
    });

    window.openHistoryModal = function (id, admision) {
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
                    html += `<div class="history-entry">Modificado | ${log.userFullName || 'Desconocido'} | ${log.username || 'desconocido'} | ${date} | Admisión: ${log.oldData ? log.oldData.admision : 'N/A'} → ${log.newData ? log.newData.admision : 'N/A'}</div>`;
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

    codigoInput.addEventListener('blur', async () => {
        const codigo = codigoInput.value.trim().toUpperCase();
        if (codigo) {
            showLoading();
            try {
                const producto = await getProductoByCodigo(codigo);
                if (producto) {
                    referenciaInput.value = producto.referencia || '';
                    proveedorInput.value = producto.proveedor || '';
                    precioUnitarioInput.value = producto.precioUnitario ? formatNumberWithThousandsSeparator(producto.precioUnitario) : '';
                    atributoInput.value = producto.atributo || '';
                    descripcionInput.value = producto.descripcion || '';
                    if (cantidadInput.value) {
                        totalItemsInput.value = (parseInt(cantidadInput.value) * (producto.precioUnitario || 0)).toString();
                    }
                } else {
                    referenciaInput.value = '';
                    proveedorInput.value = '';
                    precioUnitarioInput.value = '';
                    atributoInput.value = '';
                    descripcionInput.value = '';
                    totalItemsInput.value = '';
                    showToast('Código no encontrado.', 'error');
                }
                hideLoading();
            } catch (error) {
                hideLoading();
                showToast('Error al buscar el código: ' + error.message, 'error');
            }
        }
    });

    cantidadInput.addEventListener('input', () => {
        const cantidad = parseInt(cantidadInput.value) || 0;
        const precioUnitario = parseInt(precioUnitarioInput.value.replace(/[^\d]/g, '')) || 0;
        totalItemsInput.value = (cantidad * precioUnitario).toString();
    });

    editCodigoInput.addEventListener('blur', async () => {
        const codigo = editCodigoInput.value.trim().toUpperCase();
        if (codigo) {
            showLoading();
            try {
                const producto = await getProductoByCodigo(codigo);
                if (producto) {
                    editReferenciaInput.value = producto.referencia || '';
                    editProveedorInput.value = producto.proveedor || '';
                    editPrecioUnitarioInput.value = producto.precioUnitario ? formatNumberWithThousandsSeparator(producto.precioUnitario) : '';
                    editAtributoInput.value = producto.atributo || '';
                    editDescripcionInput.value = producto.descripcion || '';
                    if (editCantidadInput.value) {
                        editTotalItemsInput.value = (parseInt(editCantidadInput.value) * (producto.precioUnitario || 0)).toString();
                    }
                } else {
                    editReferenciaInput.value = '';
                    editProveedorInput.value = '';
                    editPrecioUnitarioInput.value = '';
                    editAtributoInput.value = '';
                    editDescripcionInput.value = '';
                    editTotalItemsInput.value = '';
                    showToast('Código no encontrado.', 'error');
                }
                hideLoading();
            } catch (error) {
                hideLoading();
                showToast('Error al buscar el código: ' + error.message, 'error');
            }
        }
    });

    editCantidadInput.addEventListener('input', () => {
        const cantidad = parseInt(editCantidadInput.value) || 0;
        const precioUnitario = parseInt(editPrecioUnitarioInput.value.replace(/[^\d]/g, '')) || 0;
        editTotalItemsInput.value = (cantidad * precioUnitario).toString();
    });

    onAuthStateChanged(auth, async (user) => {
        console.log('Estado de autenticación:', user ? `Usuario autenticado: ${user.email}` : 'No autenticado');
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
            await loadMedicos();
            setupAutocomplete('medico', 'medicoToggle', 'medicoDropdown');
            setupAutocomplete('editMedico', 'editMedicoToggle', 'editMedicoDropdown');

            const currentYear = new Date().getFullYear();
            for (let year = currentYear; year >= currentYear - 10; year--) {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                anioSelect.appendChild(option);
            }

            await loadRegistros();
        } catch (error) {
            window.currentUserData = { fullName: 'Usuario Invitado', username: 'invitado' };
            showToast('Error al cargar datos del usuario.', 'error');
        }
    });
});