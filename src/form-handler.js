// Form Handler - pendiente de integrar con Supabase

async function submitContactForm(name, email, message, phone) {
  // TODO: Guardar en Supabase
  console.log("submitContactForm", { name, email, message, phone });
  alert("Función pendiente de integrar con Supabase.");
}

async function subscribeNewsletter(email) {
  // TODO: Guardar en Supabase
  console.log("subscribeNewsletter", { email });
  alert("Función pendiente de integrar con Supabase.");
}

export { submitContactForm, subscribeNewsletter };
