import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth, onAuthStateChanged, reauthenticateWithCredential, EmailAuthProvider, updatePassword } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

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

const form = document.getElementById('changePasswordForm');
const message = document.getElementById('message');
const changePasswordBtn = document.getElementById('changePasswordBtn');

onAuthStateChanged(auth, (user) => {
    if (!user) {
        showMessage('Debes estar autenticado para cambiar la contraseña.', 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
    }
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const repeatNewPassword = document.getElementById('repeatNewPassword').value;

    if (!currentPassword || !newPassword || !repeatNewPassword) {
        showMessage('Por favor, complete todos los campos.', 'error');
        return;
    }

    if (newPassword !== repeatNewPassword) {
        showMessage('Las nuevas contraseñas no coinciden.', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showMessage('La nueva contraseña debe tener al menos 6 caracteres.', 'error');
        return;
    }

    changePasswordBtn.disabled = true;
    changePasswordBtn.value = 'Cambiando...';
    showMessage('Procesando cambio de contraseña...', 'loading');

    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('No hay usuario autenticado.');
        }

        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);

        await updatePassword(user, newPassword);

        showMessage('Contraseña cambiada exitosamente. Redirigiendo...', 'success');
        form.reset();
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
    } catch (error) {
        console.error('Error:', error);
        if (error.code === 'auth/wrong-password') {
            showMessage('La contraseña actual es incorrecta.', 'error');
        } else if (error.code === 'auth/too-many-requests') {
            showMessage('Demasiados intentos. Intente de nuevo más tarde.', 'error');
        } else {
            showMessage('Error al cambiar la contraseña: ' + error.message, 'error');
        }
        resetButtonState();
    }
});

function showMessage(text, type) {
    message.textContent = text;
    message.className = type;
    message.style.display = 'block';
    if (type !== 'loading') {
        setTimeout(() => {
            message.style.display = 'none';
        }, 5000);
    }
}

function resetButtonState() {
    changePasswordBtn.disabled = false;
    changePasswordBtn.value = 'Cambiar Contraseña';
}