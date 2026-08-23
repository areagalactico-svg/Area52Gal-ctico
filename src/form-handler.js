// Form Handler con Firebase Firestore
// Este archivo maneja el envío de datos de contacto a Firestore

async function initializeFirebase(firebaseConfig) {
  // Este código se ejecutará cuando Firebase esté cargado
  try {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase inicializado correctamente");
    return firebase;
  } catch (error) {
    console.error("Error al inicializar Firebase:", error);
  }
}

// Función para enviar contacto a Firebase
async function submitContactForm(name, email, message, phone) {
  try {
    const db = firebase.firestore();
    
    const docRef = await db.collection("contactos").add({
      nombre: name,
      email: email,
      mensaje: message,
      telefono: phone,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      leido: false
    });

    console.log("Contacto guardado con ID:", docRef.id);
    alert("¡Gracias por tu mensaje! Nos pondremos en contacto pronto.");
    return docRef.id;
  } catch (error) {
    console.error("Error al guardar contacto:", error);
    alert("Hubo un error al enviar el mensaje. Por favor, intenta nuevamente.");
    throw error;
  }
}

// Función para suscribirse a newsletter
async function subscribeNewsletter(email) {
  try {
    const db = firebase.firestore();
    
    const docRef = await db.collection("newsletter").add({
      email: email,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      suscrito: true
    });

    console.log("Suscripción guardada con ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error al suscribirse:", error);
    throw error;
  }
}

export { initializeFirebase, submitContactForm, subscribeNewsletter };
