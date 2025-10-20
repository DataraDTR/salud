// AUTOCOMPLETE SETUP
function setupAutocomplete(inputId, iconId, listId, data, key) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    const list = document.getElementById(listId);

    if (!input || !icon || !list) return;

    function showSuggestions(value) {
        list.innerHTML = '';
        if (!value.trim()) {
            list.style.display = 'none';
            return;
        }
        
        const filtered = data.filter(item => 
            item[key]?.toLowerCase().includes(value.toLowerCase())
        );
        
        if (filtered.length === 0) {
            list.style.display = 'none';
            return;
        }

        filtered.slice(0, 10).forEach(item => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            div.textContent = item[key];
            div.title = item[key];
            div.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                input.value = item[key];
                list.style.display = 'none';
                fillFields(item, inputId);
                input.dispatchEvent(new Event('change'));
                input.focus();
            });
            list.appendChild(div);
        });
        list.style.display = 'block';
        list.style.maxHeight = '200px';
        list.style.overflowY = 'auto';
    }

    function showAll() {
        list.innerHTML = '';
        data.slice(0, 20).forEach(item => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            div.textContent = item[key];
            div.title = item[key];
            div.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                input.value = item[key];
                list.style.display = 'none';
                fillFields(item, inputId);
                input.dispatchEvent(new Event('change'));
                input.focus();
            });
            list.appendChild(div);
        });
        list.style.display = 'block';
        list.style.maxHeight = '200px';
        list.style.overflowY = 'auto';
    }

    input.addEventListener('input', (e) => showSuggestions(e.target.value));
    input.addEventListener('focus', () => input.value.trim() && showSuggestions(input.value));
    icon.addEventListener('click', (e) => {
        e.stopPropagation();
        if (list.style.display === 'block') list.style.display = 'none';
        else { showAll(); input.focus(); }
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !icon.contains(e.target) && !list.contains(e.target)) {
            list.style.display = 'none';
        }
    });

    list.addEventListener('keydown', (e) => {
        const items = list.querySelectorAll('.autocomplete-item');
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const currentIndex = Array.from(items).findIndex(item => item.classList.contains('highlighted'));
            if (currentIndex < items.length - 1) {
                if (currentIndex >= 0) items[currentIndex].classList.remove('highlighted');
                items[currentIndex + 1].classList.add('highlighted');
                items[currentIndex + 1].scrollIntoView({ block: 'nearest' });
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const currentIndex = Array.from(items).findIndex(item => item.classList.contains('highlighted'));
            if (currentIndex > 0) {
                if (currentIndex >= 0) items[currentIndex].classList.remove('highlighted');
                items[currentIndex - 1].classList.add('highlighted');
                items[currentIndex - 1].scrollIntoView({ block: 'nearest' });
            }
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            const highlighted = list.querySelector('.highlighted');
            if (highlighted) highlighted.click();
            else if (items.length > 0) items[0].click();
        } else if (e.key === 'Escape') {
            list.style.display = 'none';
            input.blur();
        }
    });
}

// LLENAR CAMPOS
function fillFields(item, inputId) {
    const isEdit = inputId.startsWith('edit');
    const codigoInput = isEdit ? document.getElementById('editCodigo') : document.getElementById('codigo');
    const descripcionInput = isEdit ? document.getElementById('editDescripcion') : document.getElementById('descripcion');
    const referenciaInput = isEdit ? document.getElementById('editReferencia') : document.getElementById('referencia');
    const proveedorInput = isEdit ? document.getElementById('editProveedor') : document.getElementById('proveedor');
    const precioUnitarioInput = isEdit ? document.getElementById('editPrecioUnitario') : document.getElementById('precioUnitario');
    const atributoInput = isEdit ? document.getElementById('editAtributo') : document.getElementById('atributo');

    if (inputId.includes('Descripcion') || inputId.includes('descripcion')) {
        if (codigoInput) codigoInput.value = item.codigo || '';
        if (descripcionInput) descripcionInput.value = item.descripcion || '';
        if (referenciaInput) referenciaInput.value = item.referencia || '';
        if (proveedorInput) proveedorInput.value = item.proveedor || '';
        if (precioUnitarioInput) precioUnitarioInput.value = item.precioUnitario ? formatNumberWithThousandsSeparator(item.precioUnitario) : '';
        if (atributoInput) atributoInput.value = item.atributo || '';
    } else if (inputId.includes('Codigo') || inputId.includes('codigo')) {
        if (descripcionInput) descripcionInput.value = item.descripcion || '';
        if (referenciaInput) referenciaInput.value = item.referencia || '';
        if (proveedorInput) proveedorInput.value = item.proveedor || '';
        if (precioUnitarioInput) precioUnitarioInput.value = item.precioUnitario ? formatNumberWithThousandsSeparator(item.precioUnitario) : '';
        if (atributoInput) atributoInput.value = item.atributo || '';
    }

    setTimeout(() => updateTotalItems(isEdit), 100);
}

// ACTUALIZAR TOTAL
function updateTotalItems(isEdit = false) {
    const cantidadInput = isEdit ? document.getElementById('editCantidad') : document.getElementById('cantidad');
    const precioUnitarioInput = isEdit ? document.getElementById('editPrecioUnitario') : document.getElementById('precioUnitario');
    const totalItemsInput = isEdit ? document.getElementById('editTotalItems') : document.getElementById('totalItems');

    const cantidad = parseInt(cantidadInput?.value) || 0;
    const precioUnitario = parseInt((precioUnitarioInput?.value || '').replace(/[^\d]/g, '')) || 0;
    const total = cantidad * precioUnitario;
    totalItemsInput.value = total ? formatNumberWithThousandsSeparator(total) : '';
}

// LIMPIAR FORMULARIO
function clearForm() {
    ['admision', 'paciente', 'medico', 'codigo', 'descripcion', 'cantidad', 'referencia', 
     'proveedor', 'precioUnitario', 'atributo', 'totalItems'].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = '';
    });
    document.getElementById('fechaCX').value = '';
    document.getElementById('medicoDropdown').style.display = 'none';
    document.getElementById('editMedicoDropdown').style.display = 'none';
}

// CERRAR MODAL
function closeModal(modal) {
    if (modal) modal.style.display = 'none';
    
    if (modal.id === 'editModal') {
        window.currentEditId = null;
        window.currentEditOldData = null;
        document.getElementById('editMedicoDropdown').style.display = 'none';
    } else if (modal.id === 'deleteModal') {
        window.currentDeleteId = null;
        window.currentDeleteAdmision = null;
    } else if (modal.id === 'historyModal') {
        document.getElementById('historyContent').innerHTML = '';
    }
}

// MAYÚSCULAS
function enforceUpperCase(inputs) {
    inputs.forEach(input => {
        if (input) {
            input.addEventListener('input', (e) => e.target.value = e.target.value.toUpperCase());
            input.addEventListener('change', (e) => e.target.value = e.target.value.toUpperCase().trim());
        }
    });
}

// FORMATO MONTO
function formatMontoInput(input) {
    if (!input) return;
    input.addEventListener('input', (e) => {
        let value = e.target.value.replace(/[^\d]/g, '');
        if (value) e.target.value = formatNumberWithThousandsSeparator(value);
    });
    input.addEventListener('focus', (e) => e.target.value = e.target.value.replace(/[^\d]/g, ''));
    input.addEventListener('blur', (e) => {
        if (e.target.value) e.target.value = formatNumberWithThousandsSeparator(e.target.value.replace(/[^\d]/g, ''));
    });
}

// RENDER TABLA
function renderTable(registros, totalRecords) {
    const registrarBody = document.querySelector('#registrarTable tbody');
    if (!registrarBody) return;

    registrarBody.innerHTML = '';
    
    if (registros.length === 0) {
        registrarBody.innerHTML = `
            <tr>
                <td colspan="13" style="text-align: center; padding: 20px; color: #666;">
                    <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 10px; display: block;"></i>
                    No hay registros para mostrar
                </td>
            </tr>
        `;
    } else {
        registros.forEach(registro => {
            const row = document.createElement('tr');
            row.className = 'registrar-row';
            
            row.innerHTML = `
                <td class="registrar-cell admision">${escapeHtml(registro.admision || '')}</td>
                <td class="registrar-cell paciente">${escapeHtml(registro.paciente || '')}</td>
                <td class="registrar-cell medico">${escapeHtml(registro.medico || '')}</td>
                <td class="registrar-cell fecha">${registro.fechaCX ? registro.fechaCX.toLocaleDateString('es-CL') : ''}</td>
                <td class="registrar-cell codigo">${escapeHtml(registro.codigo || '')}</td>
                <td class="registrar-cell descripcion">${escapeHtml(registro.descripcion || '')}</td>
                <td class="registrar-cell cantidad">${registro.cantidad || ''}</td>
                <td class="registrar-cell referencia">${escapeHtml(registro.referencia || '')}</td>
                <td class="registrar-cell proveedor">${escapeHtml(registro.proveedor || '')}</td>
                <td class="registrar-cell precio">${formatNumberWithThousandsSeparator(registro.precioUnitario)}</td>
                <td class="registrar-cell atributo">${escapeHtml(registro.atributo || '')}</td>
                <td class="registrar-cell total">${formatNumberWithThousandsSeparator(registro.totalItems)}</td>
                <td class="registrar-actions">
                    <div class="registrar-actions">
                        <button title="Editar registro" class="registrar-btn-edit" onclick="window.openEditModal('${registro.id}', ${JSON.stringify(registro).replace(/"/g, '&quot;')})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button title="Eliminar registro" class="registrar-btn-delete" onclick="window.openDeleteModal('${registro.id}', '${escapeHtml(registro.admision || '')}')">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button title="Ver historial" class="registrar-btn-history" onclick="window.openHistoryModal('${registro.id}', '${escapeHtml(registro.admision || '')}')">
                            <i class="fas fa-history"></i>
                        </button>
                    </div>
                </td>
            `;
            registrarBody.appendChild(row);
        });
    }

    updatePagination(totalRecords);
    setupColumnResize();
}

// PAGINACIÓN
function updatePagination(total) {
    const PAGE_SIZE = 50;
    const totalPages = Math.ceil(total / PAGE_SIZE);
    const currentPage = window.currentPage || 1;
    const startRecord = (currentPage - 1) * PAGE_SIZE + 1;
    const endRecord = Math.min(currentPage * PAGE_SIZE, total);
    
    document.getElementById('paginationInfo').innerHTML = `
        <span class="pagination-info">
            <strong>Página ${currentPage} de ${totalPages}</strong> | 
            Mostrando ${startRecord} - ${endRecord} de ${total} registros
        </span>
    `;

    const prevPage = document.getElementById('prevPage');
    const nextPage = document.getElementById('nextPage');
    const pageNumbers = document.getElementById('pageNumbers');

    prevPage.disabled = currentPage === 1;
    nextPage.disabled = currentPage === totalPages || total === 0;
    prevPage.innerHTML = '<i class="fas fa-chevron-left"></i>';
    nextPage.innerHTML = '<i class="fas fa-chevron-right"></i>';

    pageNumbers.innerHTML = '';
    
    if (totalPages > 1) {
        // Primera página
        const firstBtn = document.createElement('button');
        firstBtn.innerHTML = '1';
        firstBtn.className = currentPage === 1 ? 'active' : '';
        firstBtn.addEventListener('click', () => window.goToPage(1));
        pageNumbers.appendChild(firstBtn);

        const startPage = Math.max(2, currentPage - 2);
        const endPage = Math.min(totalPages - 1, currentPage + 2);
        
        if (startPage > 2) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.className = 'page-dots';
            pageNumbers.appendChild(dots);
        }

        for (let i = startPage; i <= endPage; i++) {
            const btn = document.createElement('button');
            btn.textContent = i;
            btn.className = i === currentPage ? 'active' : '';
            btn.addEventListener('click', () => window.goToPage(i));
            pageNumbers.appendChild(btn);
        }

        if (endPage < totalPages - 1) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.className = 'page-dots';
            pageNumbers.appendChild(dots);
        }

        if (currentPage !== totalPages) {
            const lastBtn = document.createElement('button');
            lastBtn.innerHTML = totalPages;
            lastBtn.className = currentPage === totalPages ? 'active' : '';
            lastBtn.addEventListener('click', () => window.goToPage(totalPages));
            pageNumbers.appendChild(lastBtn);
        }
    }
}