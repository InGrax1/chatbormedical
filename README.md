# MediAssist Webhook

Webhook para el chatbot médico MediAssist (Dialogflow ES + Gemini AI).

## Estructura del proyecto

```
mediassist-webhook/
├── index.js          ← Servidor principal, maneja todos los intents
├── gemini.js         ← Módulo de IA (solo se usa en fallbacks y ayuda)
├── package.json
├── .env.example      ← Plantilla de variables de entorno
└── .gitignore
```

## Cómo correr localmente

### 1. Instalar dependencias
```bash
npm install
```

### 2. Crear tu archivo .env
```bash
# Copia el archivo de ejemplo
copy .env.example .env
```
Luego abre `.env` y pega tu GEMINI_API_KEY.

### 3. Correr el servidor
```bash
# Modo desarrollo (se reinicia automáticamente al guardar)
npm run dev

# Modo producción
npm start
```

Verás esto cuando esté listo:
```
✅ MediAssist Webhook corriendo en puerto 3000
   Gemini AI: ✅ configurado
   Endpoint: POST /webhook
```

## Variables de entorno necesarias

| Variable | Descripción | Dónde conseguirla |
|---|---|---|
| `GEMINI_API_KEY` | API Key de Google Gemini | https://aistudio.google.com/app/apikey |

## Deploy en Railway

1. Sube este proyecto a GitHub
2. En Railway: New Project → Deploy from GitHub repo
3. En Variables agrega: `GEMINI_API_KEY` = tu key
4. Railway despliega automáticamente

La URL del webhook será algo como:
```
https://tu-proyecto.up.railway.app/webhook
```

Esa URL la pegas en Dialogflow → Fulfillment → Webhook URL.

## Cuándo usa Gemini AI

Gemini **solo** se llama en dos casos:
- **Default Fallback Intent**: cuando el usuario dice algo que Dialogflow no entiende
- **medic.ayuda**: cuando el usuario pide ayuda durante el proceso

El resto del flujo usa respuestas fijas del webhook (más rápido y sin costo).
