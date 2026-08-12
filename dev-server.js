import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createUserHandler from "./api/create-user.js";
import sendEmailHandler from "./api/send-email.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3100;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

async function cargarEnv() {
  try {
    const contenido = await readFile(path.join(ROOT, ".env"), "utf8");
    contenido.split(/\r?\n/).forEach((linea) => {
      const limpia = linea.trim();
      if (!limpia || limpia.startsWith("#") || !limpia.includes("=")) return;
      const indice = limpia.indexOf("=");
      const clave = limpia.slice(0, indice).trim();
      let valor = limpia.slice(indice + 1).trim();
      if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) valor = valor.slice(1, -1);
      if (!process.env[clave]) process.env[clave] = valor;
    });
  } catch (error) {
    console.error("No se pudo cargar .env:", error.message);
  }
}

function prepararRespuestaApi(res) {
  res.status = (codigo) => {
    res.statusCode = codigo;
    return res;
  };
  res.json = (datos) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(datos));
  };
  return res;
}

function prepararCorsLocal(req, res) {
  const origen = req.headers.origin;
  if (/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origen || "")) {
    res.setHeader("Access-Control-Allow-Origin", origen);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "POST, PATCH, OPTIONS");
  }
}

async function leerBody(req) {
  const partes = [];
  let total = 0;
  for await (const parte of req) {
    total += parte.length;
    if (total > 1_000_000) throw new Error("Solicitud demasiado grande");
    partes.push(parte);
  }
  if (!partes.length) return {};
  return JSON.parse(Buffer.concat(partes).toString("utf8"));
}

async function servirArchivo(req, res, url) {
  let rutaUrl = decodeURIComponent(url.pathname);
  if (rutaUrl === "/") rutaUrl = "/index.html";
  const destino = path.resolve(ROOT, `.${rutaUrl}`);
  if (!destino.startsWith(`${ROOT}${path.sep}`)) {
    res.writeHead(403).end("Acceso denegado");
    return;
  }
  try {
    let archivo = destino;
    if ((await stat(archivo)).isDirectory()) archivo = path.join(archivo, "index.html");
    const contenido = await readFile(archivo);
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(archivo).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(contenido);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Recurso no encontrado");
  }
}

await cargarEnv();

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    prepararCorsLocal(req, res);
    if (req.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      res.writeHead(204).end();
      return;
    }
    if (url.pathname === "/api/create-user") {
      req.body = await leerBody(req);
      await createUserHandler(req, prepararRespuestaApi(res));
      return;
    }
    if (url.pathname === "/api/send-email") {
      req.body = await leerBody(req);
      await sendEmailHandler(req, prepararRespuestaApi(res));
      return;
    }
    await servirArchivo(req, res, url);
  } catch (error) {
    console.error("API/servidor:", error?.message || error);
    if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: process.env.NODE_ENV === "production"
        ? "Error interno del servidor."
        : `Error local: ${error?.message || "fallo desconocido"}`,
    }));
  }
}).listen(PORT, () => {
  console.log(`TAMAKU disponible en http://localhost:${PORT}`);
});
