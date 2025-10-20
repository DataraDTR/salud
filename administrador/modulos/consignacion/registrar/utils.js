// FORMATO NÚMEROS
function formatNumberWithThousandsSeparator(number) {
    if (!number) return '';
    const cleaned = String(number).replace(/[^\d]/g, '');
    return cleaned ? Number(cleaned).toLocaleString('es-CL') : '';
}

// DEBOUNCE PARA BÚSQUEDA
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// TOAST NOTIFICACIONES
function showToast(text, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    const existingToasts = toastContainer.querySelectorAll(`.registrar-toast.${type}`);
    existingToasts.forEach(toast => toast.remove());

    const toast = document.createElement('div');
    toast.className = `registrar-toast ${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i>
        ${text}
    `;
    
    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ESCAPAR HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text?.replace(/[&<>"']/g, m => map[m]) || '';
}

// REDIMENSIONAR COLUMNAS
function setupColumnResize() {
    const table = document.querySelector('.registrar-table');
    const headers = document.querySelectorAll('.registrar-table th');
    
    const initialWidths = [100, 130, 200, 120, 100, 300, 80, 130, 150, 120, 120, 100, 100];

    headers.forEach((header, index) => {
        if (initialWidths[index]) {
            header.style.width = `${initialWidths[index]}px`;
            header.style.minWidth = `${initialWidths[index]}px`;
            header.style.maxWidth = `${initialWidths[index] * 2}px`;
            
            const cells = document.querySelectorAll(`.registrar-table td:nth-child(${index + 1})`);
            cells.forEach(cell => {
                cell.style.width = `${initialWidths[index]}px`;
                cell.style.minWidth = `${initialWidths[index]}px`;
                cell.style.maxWidth = `${initialWidths[index] * 2}px`;
            });
        }
    });

    headers.forEach((header, index) => {
        const existingHandle = header.querySelector('.resize-handle');
        if (existingHandle) existingHandle.remove();

        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        resizeHandle.style.cssText = `
            position: absolute; right: 0; top: 0; bottom: 0; width: 5px;
            cursor: col-resize; background: transparent; z-index: 10;
        `;
        header.appendChild(resizeHandle);
        header.style.position = 'relative';

        let isResizing = false, startX, startWidth;

        const startResize = (e) => {
            isResizing = true;
            startX = e.pageX || (e.touches && e.touches[0].pageX);
            startWidth = parseFloat(getComputedStyle(header).width);
            document.body.style.userSelect = 'none';
            resizeHandle.classList.add('active');
            e.preventDefault();
        };

        const resize = (e) => {
            if (!isResizing) return;
            const clientX = e.pageX || (e.touches && e.touches[0].pageX);
            if (!clientX) return;

            const delta = clientX - startX;
            const newWidth = Math.max(50, Math.min(400, startWidth + delta));

            header.style.width = `${newWidth}px`;
            header.style.minWidth = `${newWidth}px`;

            const cells = document.querySelectorAll(`.registrar-table td:nth-child(${index + 1})`);
            cells.forEach(cell => {
                cell.style.width = `${newWidth}px`;
                cell.style.minWidth = `${newWidth}px`;
            });

            resizeHandle.style.left = `${newWidth - 5}px`;
        };

        const stopResize = () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.userSelect = '';
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

// EXPORTAR EXCEL
function exportToExcel(data, filename) {
    if (typeof XLSX === 'undefined') {
        showToast('❌ Librería ExcelJS no cargada', 'error');
        return;
    }

    const headers = [
        'Admisión', 'Paciente', 'Médico', 'Fecha CX', 'Código', 
        'Descripción', 'Cantidad', 'Referencia', 'Proveedor', 
        'Precio Unitario', 'Atributo', 'Total Items'
    ];

    const exportData = data.map(reg => [
        reg.admision || '',
        reg.paciente || '',
        reg.medico || '',
        reg.fechaCX ? reg.fechaCX.toLocaleDateString('es-CL') : '',
        reg.codigo || '',
        reg.descripcion || '',
        reg.cantidad || '',
        reg.referencia || '',
        reg.proveedor || '',
        formatNumberWithThousandsSeparator(reg.precioUnitario),
        reg.atributo || '',
        formatNumberWithThousandsSeparator(reg.totalItems)
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...exportData]);
    
    const colWidths = headers.map((header, i) => {
        const maxLength = Math.max(
            header.length,
            ...exportData.map(row => (row[i] || '').toString().length)
        );
        return { wch: Math.min(Math.max(maxLength + 2, 10), 50) };
    });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Consignaciones');
    XLSX.writeFile(wb, filename + '.xlsx');
}

// PARSEAR FECHA
function parseFechaCX(fecha) {
    if (!fecha) return null;
    if (fecha && typeof fecha.toDate === 'function') return fecha.toDate();
    if (fecha instanceof Date) return fecha;
    return new Date(fecha);
}