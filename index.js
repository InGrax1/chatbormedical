// index.js
// Webhook principal de MediAssist para Dialogflow ES

const express = require("express");
const { responderConIA } = require("./gemini");
const { guardarConsulta } = require("./sheets");

const app = express();
app.use(express.json());

// ─────────────────────────────────────────────
// Store en memoria por sesión
// Dialogflow no propaga todos los parámetros hacia adelante — los contextos
// awaiting-* mueren conforme avanza el flujo. Por eso guardamos cada dato
// aquí cuando el webhook lo recibe, y al confirmar tenemos todo completo.
// ─────────────────────────────────────────────
const sesiones = {};

function getSessionId(req) {
  const session = req.body.session || "";
  return session.split("/").pop();
}

function guardarDato(req, campos) {
  const sid = getSessionId(req);
  if (!sesiones[sid]) sesiones[sid] = { _ts: Date.now() };
  Object.assign(sesiones[sid], campos);
  sesiones[sid]._ts = Date.now();
}

function getDatosSesion(req) {
  const sid = getSessionId(req);
  return sesiones[sid] || {};
}

function limpiarSesion(req) {
  const sid = getSessionId(req);
  delete sesiones[sid];
}

// Limpiar sesiones viejas cada hora
setInterval(() => {
  const ahora = Date.now();
  for (const sid of Object.keys(sesiones)) {
    if (ahora - (sesiones[sid]._ts || 0) > 3600000) delete sesiones[sid];
  }
}, 3600000);

// ─────────────────────────────────────────────
// Utilidad: etapa actual
// ─────────────────────────────────────────────
function getEtapa(req) {
  const contexts = req.body.queryResult.outputContexts || [];
  const awaitingCtx = contexts.find((c) => c.name.includes("awaiting-"));
  if (!awaitingCtx) return "inicio";
  return awaitingCtx.name.split("/").pop();
}

// ─────────────────────────────────────────────
// Endpoint principal del webhook
// ─────────────────────────────────────────────
app.post("/webhook", async (req, res) => {
  const action = req.body.queryResult.action;
  const queryText = req.body.queryResult.queryText;
  const params = req.body.queryResult.parameters || {};

  console.log(`[Webhook] Action: ${action} | Texto: "${queryText}"`);

  try {

    // ── 1. FALLBACK GLOBAL: Gemini responde cuando Dialogflow no entiende ──
    if (action === "input.unknown") {
      const datos = getDatosSesion(req);
      const etapa = getEtapa(req);
      const respuesta = await responderConIA(queryText, {
        nombre: datos.nombre,
        sintoma: datos.sintoma,
        etapa,
      });
      return res.json({ fulfillmentText: respuesta });
    }

    // ── 2. NOMBRE ──
    if (action === "medic.nombre") {
      const nombre = params.nombre || queryText;
      guardarDato(req, { nombre });
      console.log(`[Webhook] Nombre: ${nombre}`);
      return res.json({});
    }

    // ── 3. EDAD ──
    if (action === "medic.edad") {
      const edad = params.edad || queryText;
      guardarDato(req, { edad });
      console.log(`[Webhook] Edad: ${edad}`);
      return res.json({});
    }

    // ── 4. SÍNTOMA PRINCIPAL ──
    if (action === "medic.sintoma") {
      const sintoma = params.sintoma_texto || queryText;
      guardarDato(req, { sintoma });
      console.log(`[Webhook] Síntoma: ${sintoma}`);
      return res.json({});
    }

    // ── 5. SEGUIMIENTO ──
    if (action === "medic.seguimiento") {
      const seguimiento = params.respuesta || queryText;
      guardarDato(req, { seguimiento });
      console.log(`[Webhook] Seguimiento: ${seguimiento}`);
      return res.json({});
    }

    // ── 6. DURACIÓN ──
    if (action === "medic.duracion") {
      const duracion = params.duracion_texto || params.duracion_sistema || queryText;
      guardarDato(req, { duracion });
      console.log(`[Webhook] Duración: ${duracion}`);
      return res.json({});
    }

    // ── 7. INTENSIDAD ──
    if (action === "medic.intensidad") {
      const intensidad = String(params.intensidad_num || params.intensidad || queryText);
      guardarDato(req, { intensidad });
      console.log(`[Webhook] Intensidad: ${intensidad}`);
      return res.json({});
    }

    // ── 8. SÍNTOMAS ADICIONALES ──
    if (action === "medic.adicionales") {
      const adicionales = params.adicionales || queryText;
      guardarDato(req, { adicionales });
      console.log(`[Webhook] Adicionales: ${adicionales}`);
      return res.json({});
    }

    // ── 9. MEDICAMENTOS → mostrar horarios ──
    if (action === "medic.medicamentos") {
      const medicamentos = params.medicamentos || queryText;
      guardarDato(req, { medicamentos });
      console.log(`[Webhook] Medicamentos: ${medicamentos}`);
      console.log(`[Webhook] Sesión completa hasta ahora:`, getDatosSesion(req));

      const respuesta =
        `✅ *Registro completado*\n\n` +
        `He recopilado toda la información para el Dr. González.\n\n` +
        `📅 *Horarios disponibles esta semana:*\n` +
        `1️⃣ Mañana a las 10:00 AM\n` +
        `2️⃣ Pasado mañana a las 4:00 PM\n` +
        `3️⃣ Viernes a las 9:00 AM\n\n` +
        `¿Cuál horario te conviene? Di el número o la fecha y hora.`;

      return res.json({ fulfillmentText: respuesta });
    }

    // ── 10. SELECCIÓN DE HORARIO ──
    if (action === "medic.horario") {
      const opcion = params.opcion;
      const fecha = params.fecha;
      const hora = params.hora;

      let cita = "";
      if (opcion) {
        const opciones = { 1: "Mañana a las 10:00 AM", 2: "Pasado mañana a las 4:00 PM", 3: "Viernes a las 9:00 AM" };
        cita = opciones[opcion] || `Opción ${opcion}`;
      } else if (fecha && hora) {
        cita = `${fecha} a las ${hora}`;
      } else {
        cita = queryText;
      }

      guardarDato(req, { cita });
      console.log(`[Webhook] Cita seleccionada: ${cita}`);

      const respuesta =
        `📋 *Confirma tu cita:*\n\n` +
        `🗓️ Horario: *${cita}*\n` +
        `👨‍⚕️ Doctor: Dr. González\n\n` +
        `¿Confirmas esta cita? (Sí / No)`;

      return res.json({ fulfillmentText: respuesta });
    }

    // ── 11. CONFIRMAR CITA → guardar en Sheets ──
    if (action === "medic.confirmar") {
      const datos = getDatosSesion(req);

      const consulta = {
        nombre:       datos.nombre       || "",
        edad:         datos.edad         || "",
        sintoma:      datos.sintoma      || "",
        seguimiento:  datos.seguimiento  || "",
        duracion:     datos.duracion     || "",
        intensidad:   datos.intensidad   || "",
        adicionales:  datos.adicionales  || "",
        medicamentos: datos.medicamentos || "",
        cita:         datos.cita         || "Por confirmar",
      };

      console.log(`[Webhook] Consulta completa a guardar:`, consulta);

      guardarConsulta(consulta).catch((e) =>
        console.error("[Sheets] Error:", e.message)
      );

      limpiarSesion(req);

      const contexts = req.body.queryResult.outputContexts || [];
      const contextsToKill = contexts.map((c) => ({ name: c.name, lifespanCount: 0 }));

      const respuesta =
        `✅ *¡Cita confirmada, ${consulta.nombre || "paciente"}!*\n\n` +
        `🗓️ ${consulta.cita}\n` +
        `👨‍⚕️ Doctor: Dr. González\n\n` +
        `Tu información quedó registrada. ¡Que te mejores pronto!`;

      return res.json({ fulfillmentText: respuesta, outputContexts: contextsToKill });
    }

    // ── 12. CANCELAR / CAMBIAR HORARIO ──
    if (action === "medic.cancelar.horario") {
      return res.json({});
    }

    // ── 13. AYUDA ──
    if (action === "medic.ayuda") {
      const datos = getDatosSesion(req);
      const etapa = getEtapa(req);
      const respuesta = await responderConIA(queryText, {
        nombre: datos.nombre,
        sintoma: datos.sintoma,
        etapa,
      });
      return res.json({ fulfillmentText: respuesta });
    }

    // ── 14. REINICIAR ──
    if (action === "medic.reiniciar") {
      limpiarSesion(req);
      return res.json({});
    }

    // ── 15. DESPEDIDA ──
    if (action === "medic.despedida") {
      limpiarSesion(req);
      return res.json({});
    }

    console.warn(`[Webhook] Acción no manejada: ${action}`);
    return res.json({});

  } catch (error) {
    console.error("[Webhook] Error inesperado:", error);
    return res.json({
      fulfillmentText: "Ocurrió un error interno. Por favor intenta de nuevo en un momento.",
    });
  }
});

// ─────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "ok", servicio: "MediAssist Webhook", version: "2.0.0" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ MediAssist Webhook corriendo en puerto ${PORT}`);
  console.log(`   Gemini AI: ${process.env.GEMINI_API_KEY ? "✅ configurado" : "⚠️  GEMINI_API_KEY no encontrada"}`);
  console.log(`   Endpoint: POST /webhook\n`);
});
