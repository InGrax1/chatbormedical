// index.js
// Webhook principal de MediAssist para Dialogflow ES

const express = require("express");
const { responderConIA } = require("./gemini");
const { guardarConsulta } = require("./sheets");

const app = express();
app.use(express.json());

// ─────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────

/**
 * Extrae los parámetros acumulados del contexto "consulta-activa".
 * Dialogflow guarda el estado del paciente en los output contexts.
 */
function getDatosConsulta(req) {
  const contexts = req.body.queryResult.outputContexts || [];
  const consultaCtx = contexts.find((c) => c.name.includes("consulta-activa"));
  return consultaCtx?.parameters || {};
}

/**
 * Extrae el nombre de la etapa actual (awaiting-nombre, awaiting-sintoma, etc.)
 */
function getEtapa(req) {
  const contexts = req.body.queryResult.outputContexts || [];
  const awaitingCtx = contexts.find((c) => c.name.includes("awaiting-"));
  if (!awaitingCtx) return "inicio";
  // El nombre completo es tipo: "projects/xxx/agent/sessions/yyy/contexts/awaiting-nombre"
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
      const datos = getDatosConsulta(req);
      const etapa = getEtapa(req);

      const respuesta = await responderConIA(queryText, {
        nombre: datos.nombre,
        sintoma: datos.sintoma,
        etapa: etapa,
      });

      return res.json({ fulfillmentText: respuesta });
    }

    // ── 2. NOMBRE DEL PACIENTE ──
    if (action === "medic.nombre") {
      // Dialogflow puede no parsear bien el nombre con @sys.any, leer queryText
      const nombre = params.nombre || queryText;
      console.log(`[Webhook] Nombre registrado: ${nombre}`);

      // Solo guardamos el nombre en el contexto (Dialogflow lo hace automático)
      // Respondemos con una de las frases del intent (el webhook no necesita responder aquí
      // a menos que quieras personalizar). Devolvemos vacío para que Dialogflow use su respuesta.
      return res.json({});
    }

    // ── 3. EDAD ──
    if (action === "medic.edad") {
      const edad = params.edad || queryText;
      console.log(`[Webhook] Edad registrada: ${edad}`);
      return res.json({});
    }

    // ── 4. SÍNTOMA PRINCIPAL ──
    if (action === "medic.sintoma") {
      const sintoma = params.sintoma_texto || queryText;
      console.log(`[Webhook] Síntoma registrado: ${sintoma}`);
      return res.json({});
    }

    // ── 5. PREGUNTAS DE SEGUIMIENTO (¿irradia el dolor? ¿hay fiebre? etc.) ──
    if (action === "medic.seguimiento") {
      const respuesta = params.respuesta || queryText;
      console.log(`[Webhook] Seguimiento: ${respuesta}`);
      return res.json({});
    }

    // ── 6. DURACIÓN ──
    if (action === "medic.duracion") {
      // Puede venir de la entidad custom, del sistema, o del texto libre
      const duracion =
        params.duracion_texto || params.duracion_sistema || queryText;
      console.log(`[Webhook] Duración registrada: ${duracion}`);
      return res.json({});
    }

    // ── 7. INTENSIDAD ──
    if (action === "medic.intensidad") {
      const intensidad = params.intensidad_num || params.intensidad || queryText;
      console.log(`[Webhook] Intensidad registrada: ${intensidad}`);
      return res.json({});
    }

    // ── 8. SÍNTOMAS ADICIONALES ──
    if (action === "medic.adicionales") {
      const adicionales = params.adicionales || queryText;
      console.log(`[Webhook] Síntomas adicionales: ${adicionales}`);
      return res.json({});
    }

    // ── 9. MEDICAMENTOS ──
    // Aquí es donde se genera el reporte con IA (Claude/Gemini) y se muestran horarios
    if (action === "medic.medicamentos") {
      const medicamentos = params.medicamentos || queryText;
      const datos = getDatosConsulta(req);

      console.log(`[Webhook] Medicamentos: ${medicamentos}`);
      console.log(`[Webhook] Datos completos del paciente:`, datos);

      // ── AQUÍ VA TU LLAMADA A CLAUDE/GEMINI PARA GENERAR EL REPORTE ──
      // Por ahora devolvemos los horarios disponibles directamente
      // (cuando tengas la API de Claude lista, generas el reporte y lo muestras antes de los horarios)

      const respuesta =
        `✅ *Registro completado*\n\n` +
        `He recopilado toda la información para el Dr. González.\n\n` +
        `📅 *Horarios disponibles esta semana:*\n` +
        `1️⃣ Mañana a las 10:00 AM\n` +
        `2️⃣ Pasado mañana a las 4:00 PM\n` +
        `3️⃣ Viernes a las 9:00 AM\n\n` +
        `¿Cuál horario te conviene? Puedes decir el número o indicar la fecha y hora.`;

      return res.json({ fulfillmentText: respuesta });
    }

    // ── 10. SELECCIÓN DE HORARIO ──
    if (action === "medic.horario") {
      const opcion = params.opcion;
      const fecha = params.fecha;
      const hora = params.hora;

      let horarioTexto = "";
      if (opcion) {
        const opciones = {
          1: "mañana a las 10:00 AM",
          2: "pasado mañana a las 4:00 PM",
          3: "el viernes a las 9:00 AM",
        };
        horarioTexto = opciones[opcion] || `la opción ${opcion}`;
      } else if (fecha && hora) {
        horarioTexto = `${fecha} a las ${hora}`;
      } else {
        horarioTexto = queryText;
      }

      const respuesta =
        `📋 *Confirma tu cita:*\n\n` +
        `🗓️ Horario: *${horarioTexto}*\n` +
        `👨‍⚕️ Doctor: Dr. González\n\n` +
        `¿Confirmas esta cita? (Sí / No)`;

      return res.json({ fulfillmentText: respuesta });
    }

    // ── 11. CONFIRMAR CITA ──
    if (action === "medic.confirmar") {
      const datos = getDatosConsulta(req);

      // Extraer todos los campos acumulados en el contexto
      const consultaCompleta = {
        nombre:       datos.nombre || queryText,
        edad:         datos.edad || "",
        sintoma:      datos.sintoma_texto || "",
        seguimiento:  datos.respuesta || "",
        duracion:     datos.duracion_texto || datos.duracion_sistema || "",
        intensidad:   datos.intensidad_num || datos.intensidad || "",
        adicionales:  datos.adicionales || "",
        medicamentos: datos.medicamentos || "",
        cita:         datos.cita_seleccionada || "Por confirmar",
      };

      // Guardar en Google Sheets (no bloquea la respuesta si falla)
      guardarConsulta(consultaCompleta).catch((e) =>
        console.error("[Sheets] Fallo silencioso:", e.message)
      );

      const nombre = consultaCompleta.nombre || "paciente";
      const respuesta =
        `✅ *¡Cita confirmada, ${nombre}!*\n\n` +
        `📬 El Dr. González ya tiene tu expediente listo.\n` +
        `¿Hay algo más en lo que pueda ayudarte?`;

      return res.json({ fulfillmentText: respuesta });
    }

    // ── 12. CANCELAR / CAMBIAR HORARIO ──
    if (action === "medic.cancelar.horario") {
      // Dialogflow ya maneja la respuesta de este intent, solo logueamos
      console.log(`[Webhook] Usuario quiere cambiar horario`);
      return res.json({});
    }

    // ── 13. AYUDA ──
    if (action === "medic.ayuda") {
      const datos = getDatosConsulta(req);
      const etapa = getEtapa(req);

      // Gemini explica el proceso según en qué etapa está
      const respuesta = await responderConIA(queryText, {
        nombre: datos.nombre,
        sintoma: datos.sintoma,
        etapa: etapa,
      });

      return res.json({ fulfillmentText: respuesta });
    }

    // ── 14. REINICIAR ──
    if (action === "medic.reiniciar") {
      console.log(`[Webhook] Conversación reiniciada`);
      return res.json({});
    }

    // ── 15. DESPEDIDA ──
    if (action === "medic.despedida") {
      console.log(`[Webhook] Conversación finalizada`);
      return res.json({});
    }

    // ── Acción no reconocida (no debería llegar aquí) ──
    console.warn(`[Webhook] Acción no manejada: ${action}`);
    return res.json({});

  } catch (error) {
    console.error("[Webhook] Error inesperado:", error);
    return res.json({
      fulfillmentText:
        "Ocurrió un error interno. Por favor intenta de nuevo en un momento.",
    });
  }
});

// ─────────────────────────────────────────────
// Health check (para que Railway sepa que está vivo)
// ─────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "ok", servicio: "MediAssist Webhook", version: "1.0.0" });
});

// ─────────────────────────────────────────────
// Iniciar servidor
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ MediAssist Webhook corriendo en puerto ${PORT}`);
  console.log(`   Gemini AI: ${process.env.GEMINI_API_KEY ? "✅ configurado" : "⚠️  GEMINI_API_KEY no encontrada"}`);
  console.log(`   Endpoint: POST /webhook\n`);
});
