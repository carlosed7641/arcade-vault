"use server";

import { Resend } from "resend";

type ContactPayload = {
  name: string;
  email: string;
  msg: string;
};

type ContactResult = { ok: true } | { ok: false; error: string };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MAX_LEN = 80;
const MSG_MAX_LEN = 2000;

export async function sendContactMessage(
  payload: ContactPayload,
): Promise<ContactResult> {
  const name = payload.name.trim();
  const email = payload.email.trim();
  const msg = payload.msg.trim();

  if (!EMAIL_REGEX.test(email)) {
    return { ok: false, error: "Correo inválido." };
  }
  if (name.length < 2 || name.length > NAME_MAX_LEN) {
    return {
      ok: false,
      error: "El nombre debe tener entre 2 y 80 caracteres.",
    };
  }
  if (msg.length < 1 || msg.length > MSG_MAX_LEN) {
    return {
      ok: false,
      error: "El mensaje debe tener entre 1 y 2000 caracteres.",
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL;

  if (!apiKey || !toEmail) {
    return { ok: false, error: "Configuración de correo incompleta." };
  }

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: toEmail,
      subject: "Nuevo mensaje de contacto — Arcade Vault",
      text: `Nombre: ${name}\nCorreo: ${email}\nMensaje: ${msg}`,
    });
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "No se pudo enviar el mensaje. Intenta de nuevo.",
    };
  }
}
