// sheets.js
const { google } = require("googleapis");

// ID del spreadsheet — cámbialo por el tuyo
const SPREADSHEET_ID = "1JUER7hwltjWzdPKltaywjlTzT-Y5YbvLkIeVVy6f7Ds";
const SHEET_NAME = "Hoja 1"; // nombre de la pestaña en tu sheet

/**
 * Obtiene el cliente autenticado usando las credenciales de la Service Account.
 * Las credenciales vienen de la variable de entorno GOOGLE_CREDENTIALS (JSON).
 */
function getAuthClient() {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

/**
 * Guarda una fila nueva con todos los datos de la consulta.
 * Se llama cuando el usuario confirma su cita.
 *
 * @param {object} datos - Todos los campos recopilados
 */
async function guardarConsulta(datos) {
  try {
    const auth = getAuthClient();
    const sheets = google.sheets({ version: "v4", auth });

    const ahora = new Date().toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
    });

    const fila = [
      ahora,                              // A - Fecha Registro
      datos.nombre || "",                 // B - Nombre
      datos.edad || "",                   // C - Edad
      datos.sintoma || "",                // D - Síntoma Principal
      datos.seguimiento || "",            // E - Seguimiento
      datos.duracion || "",               // F - Duración
      datos.intensidad || "",             // G - Intensidad
      datos.adicionales || "",            // H - Síntomas Adicionales
      datos.medicamentos || "",           // I - Medicamentos
      datos.cita || "",                   // J - Cita Agendada
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:J`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [fila] },
    });

    console.log(`[Sheets] Consulta guardada para: ${datos.nombre}`);
    return true;
  } catch (error) {
    console.error("[Sheets] Error al guardar:", error.message);
    return false;
  }
}

module.exports = { guardarConsulta };