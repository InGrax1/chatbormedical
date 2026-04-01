// gemini.js
// Módulo de IA — solo se llama cuando Dialogflow no entiende al usuario

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

/**
 * Responde con IA cuando el usuario dice algo que Dialogflow no reconoció.
 * Usa el contexto del paciente para no responder de forma genérica.
 *
 * @param {string} mensajeUsuario - Lo que escribió el usuario
 * @param {object} ctx - Datos del paciente recolectados hasta ahora
 */
async function responderConIA(mensajeUsuario, ctx = {}) {
  const nombre = ctx.nombre || "no registrado aún";
  const sintoma = ctx.sintoma || "no registrado aún";
  const etapa = ctx.etapa || "inicio";

  const prompt = `
Eres un asistente médico virtual amable y profesional del consultorio del Dr. González.
Tu función es ayudar a registrar una pre-consulta médica. Hablas SOLO en español.

Datos del paciente hasta ahora:
- Nombre: ${nombre}
- Síntoma principal: ${sintoma}
- Etapa actual del formulario: ${etapa}

El paciente escribió algo que el sistema no reconoció claramente: "${mensajeUsuario}"

Instrucciones:
- Responde en máximo 2 oraciones cortas y amables.
- Si es una pregunta sobre el proceso de registro, explícalo brevemente.
- Si pregunta algo médico, dile que el Dr. González lo atenderá en la consulta.
- Si es algo completamente fuera de tema, redirige con amabilidad hacia continuar el registro.
- NUNCA des diagnósticos, recetas ni consejos médicos específicos.
- NUNCA inventes datos del paciente.
`.trim();

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error("[Gemini] Error:", error.message);
    // Respuesta de fallback si Gemini falla
    return "Entendido. ¿Puedes contarme un poco más sobre cómo te sientes para continuar con el registro?";
  }
}

module.exports = { responderConIA };
