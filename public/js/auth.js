import { auth, db, provider, ADMIN_EMAIL, signInWithPopup, signOut, onAuthStateChanged, collection, getDocs, doc } from "./firebase-config.js";

let currentUser = null;

async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    if (user.email !== ADMIN_EMAIL) {
      await signOut(auth);
      alert("Acceso denegado. Solo el administrador puede acceder.");
      return null;
    }
    currentUser = user;
    return user;
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    alert("Error al iniciar sesión: " + error.message);
    return null;
  }
}

async function logout() {
  try {
    await signOut(auth);
    currentUser = null;
    window.location.href = "/admin.html";
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
  }
}

function checkAuth(callback) {
  onAuthStateChanged(auth, (user) => {
    if (user && user.email === ADMIN_EMAIL) {
      currentUser = user;
      callback(user);
    } else {
      currentUser = null;
      callback(null);
    }
  });
}

function getUser() {
  return currentUser;
}

export { loginWithGoogle, logout, checkAuth, getUser };
