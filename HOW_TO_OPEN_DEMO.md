# Cómo abrir la demo de LeadLens AI

## Opción 1 — Doble clic (más fácil)

1. Abre Finder
2. Navega a la carpeta `ai-agent-project/static-demo/`
3. Haz **doble clic** en `index.html`
4. Se abre en tu navegador — listo

## Opción 2 — Arrastrar al navegador

1. Abre Chrome, Safari o Firefox
2. Arrastra el archivo `static-demo/index.html` a la ventana del navegador

## Qué verás

El archivo simula el flujo completo del producto:

| Pantalla | Cómo llegar |
|---|---|
| Landing page | Se abre automáticamente |
| Formulario de onboarding | Click en "Empezar — $79" |
| Upload de leads | Llenar el formulario y hacer click en "Continuar al pago" |
| Processing (animación) | Click en "Usar leads de demo" |
| Resultados con 5 leads | Aparece automáticamente después del processing |
| Descarga CSV | Botón "Descargar CSV" en la pantalla de resultados |
| Descarga Markdown | Botón "Descargar Markdown" en la pantalla de resultados |

## Notas

- No necesita internet
- No necesita Node.js, npm ni ninguna instalación
- No consume APIs ni cobra nada
- Los 5 leads de ejemplo son ficticios, creados para ilustrar el output real
- Para volver al inicio, click en "← Nueva demo"

## Próximo paso

Cuando quieras configurar el proyecto real (con Claude API, Supabase y Stripe), lee `SETUP.md`.
