"use server";

import { Resend } from "resend";

type ContactPayload = {
  name: string;
  email: string;
  msg: string;
};

type ContactResult = { ok: true } | { ok: false; error: string };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendContactMessage(payload: ContactPayload): Promise<ContactResult> {
  if (!EMAIL_REGEX.test(payload.email)) {
    return { ok: false, error: "Correo inválido." };
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
      text: `Nombre: ${payload.name}\nCorreo: ${payload.email}\nMensaje: ${payload.msg}`,
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo enviar el mensaje. Intenta de nuevo." };
  }
}
