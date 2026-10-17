import {
  CATEGORICAL,
  foldOthers,
  OTHER_COLOR,
  percent,
  SPLIT_SERIES,
} from "@/src/components/modules/reportes/ReportCharts";
import {
  REPORT_KIND_LABELS,
  type ReportData,
  type ReportDatum,
  type ReportEvent,
  type ReportKind,
  type SplitDatum,
} from "@/src/hooks/useReportes";
import { REPORT_SECTIONS } from "@/src/constants/reportes";
import { formatEventRange, getEventStatus } from "@/src/utils/eventStatus";
import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

/** El PDF siempre usa la paleta clara: se imprime sobre papel blanco. */
const COLORS = CATEGORICAL.light;
const INK = "#27272a";
const MUTED = "#71717a";
const TRACK = "#f1f1f3";
const SOFT = "#f7f7f8";

const FONT_FILES = [
  { weight: 400, module: require("../assets/fonts/poppins/Poppins_400Regular.ttf") },
  { weight: 500, module: require("../assets/fonts/poppins/Poppins_500Medium.ttf") },
  { weight: 600, module: require("../assets/fonts/poppins/Poppins_600SemiBold.ttf") },
];

const LOGO_MODULE = require("../assets/images/logo-ac-color-ho.png");

let fontFaceCache: string | null = null;
let logoCache: string | null = null;

/** Logo de Atención Ciudadana incrustado en base64 (encabezado de cada página). */
async function logoSource() {
  if (logoCache) return logoCache;
  const asset = Asset.fromModule(LOGO_MODULE);
  await asset.downloadAsync();
  logoCache = Platform.OS === "web"
    ? asset.uri
    : `data:image/png;base64,${await new File(asset.localUri || asset.uri).base64()}`;
  return logoCache;
}

/** Incrusta Poppins en base64 para que el PDF no dependa de internet. */
async function poppinsFontFaces() {
  if (fontFaceCache) return fontFaceCache;
  const faces = await Promise.all(
    FONT_FILES.map(async ({ weight, module }) => {
      const asset = Asset.fromModule(module);
      await asset.downloadAsync();
      const src = Platform.OS === "web"
        ? `url("${asset.uri}") format("truetype")`
        : `url("data:font/ttf;base64,${await new File(asset.localUri || asset.uri).base64()}") format("truetype")`;
      return `@font-face { font-family: "Poppins"; font-weight: ${weight}; font-style: normal; src: ${src}; }`;
    }),
  );
  fontFaceCache = faces.join("\n");
  return fontFaceCache;
}

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const number = (value: number) => value.toLocaleString("es-MX");

function donutSvg(slices: (ReportDatum & { color: string })[], total: number) {
  const size = 150;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = slices.length > 1 ? 2 : 0;
  let offset = 0;
  const arcs = slices.map((item) => {
    const length = (item.value / total) * circumference;
    const dash = Math.max(length - gap, 0.5);
    const arc = `<circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="${item.color}" stroke-width="${stroke}" stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${size / 2} ${size / 2})" />`;
    offset += length;
    return arc;
  });
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="${TRACK}" stroke-width="${stroke}" />
      ${arcs.join("")}
      <text x="50%" y="48%" text-anchor="middle" font-family="Poppins" font-weight="500" font-size="22" fill="${INK}">${number(total)}</text>
      <text x="50%" y="62%" text-anchor="middle" font-family="Poppins" font-size="9" fill="${MUTED}">solicitudes</text>
    </svg>`;
}

function donutSection(title: string, note: string, data: ReportDatum[]) {
  const slices = foldOthers(data)
    .map((item, index) => ({ ...item, color: item.key === "__otros" ? OTHER_COLOR.light : COLORS[index] }))
    .filter((item) => item.value > 0);
  const total = slices.reduce((sum, item) => sum + item.value, 0);
  if (!total) return "";
  const legend = slices.map((item) => `
    <tr>
      <td><span class="dot" style="background:${item.color}"></span>${escapeHtml(item.label)}</td>
      <td class="num">${number(item.value)}</td>
      <td class="num muted">${percent(item.value, total)}</td>
    </tr>`).join("");
  return `
    <section class="keep">
      <h2>${title}</h2>
      ${note ? `<p class="note">${note}</p>` : ""}
      <div class="donut">
        ${donutSvg(slices, total)}
        <table class="legend"><tbody>${legend}</tbody></table>
      </div>
    </section>`;
}

function barRow(label: string, value: number, max: number, segments: { value: number; color: string }[], detail?: string) {
  const width = Math.max((value / max) * 100, 1.5);
  const fills = segments
    .filter((segment) => segment.value > 0)
    .map((segment) => `<span style="flex:${segment.value};background:${segment.color}"></span>`)
    .join("");
  return `
    <div class="bar-row">
      <div class="bar-label">${escapeHtml(label)}${detail ? `<div class="bar-detail">${escapeHtml(detail)}</div>` : ""}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${width}%">${fills}</div></div>
      <div class="bar-value">${number(value)}</div>
    </div>`;
}

function barSection(title: string, note: string, data: ReportDatum[], limit = 10) {
  const items = data.filter((item) => item.value > 0).slice(0, limit);
  if (!items.length) return "";
  const max = Math.max(...items.map((item) => item.value));
  return `
    <section class="keep">
      <h2>${title}</h2>
      ${note ? `<p class="note">${note}</p>` : ""}
      ${items.map((item) => barRow(item.label, item.value, max, [{ value: item.value, color: COLORS[0] }])).join("")}
      ${data.length > limit ? `<p class="note">Mostrando los ${limit} principales de ${data.length}.</p>` : ""}
    </section>`;
}

/**
 * Barras apiladas Trámites + Atención de Secretaría, como en la vista. En la
 * pantalla el desglose aparece al tocar la barra; en papel se imprime debajo.
 */
function splitSection(title: string, note: string, data: SplitDatum[], limit: number) {
  const items = data.filter((item) => item.value > 0).slice(0, limit);
  if (!items.length) return "";
  const max = Math.max(...items.map((item) => item.value));
  const series = SPLIT_SERIES.filter((serie) => items.some((item) => item[serie.key] > 0));
  const legend = series.length > 1
    ? `<div class="series">${series.map((serie) => `<span><span class="dot" style="background:${COLORS[serie.colorIndex]}"></span>${serie.label}</span>`).join("")}</div>`
    : "";
  const rows = items.map((item) => barRow(
    item.label,
    item.value,
    max,
    SPLIT_SERIES.map((serie) => ({ value: item[serie.key], color: COLORS[serie.colorIndex] })),
    series.length > 1 ? `Trámites ${number(item.regular)} · Atención de Secretaría ${number(item.secretary)}` : undefined,
  )).join("");
  return `
    <section class="keep">
      <h2>${title}</h2>
      ${note ? `<p class="note">${note}</p>` : ""}
      ${legend}
      ${rows}
      ${data.length > limit ? `<p class="note">Mostrando los ${limit} principales de ${data.length}.</p>` : ""}
    </section>`;
}

const STATUS_BADGE: Record<string, { background: string; color: string }> = {
  Activo: { background: "#d1fae5", color: "#047857" },
  Programado: { background: "#dbeafe", color: "#1d4ed8" },
  Finalizado: { background: "#f4f4f5", color: MUTED },
};

/** Misma tarjeta del evento que la vista de Reportes. */
function eventCard(event: ReportEvent) {
  const badge = STATUS_BADGE[event.status];
  const venue = [event.venue, event.address]
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index)
    .join(" · ");
  const rows = [
    [event.municipality, event.locality].filter(Boolean).join(" · "),
    venue,
    formatEventRange(event),
  ].filter(Boolean);
  return `
    <div class="card keep">
      <div class="card-title-row">
        <div class="card-title">${escapeHtml(event.name)}</div>
        <span class="badge" style="background:${badge.background};color:${badge.color}">${event.status}</span>
      </div>
      ${event.folioPrefix ? `<div class="muted small">Folio ${escapeHtml(event.folioPrefix)}</div>` : ""}
      <div class="event-rows">${rows.map((row) => `<div>${escapeHtml(row)}</div>`).join("")}</div>
      ${event.notes ? `<div class="muted small event-notes">${escapeHtml(event.notes)}</div>` : ""}
    </div>`;
}

/** Misma tarjeta de resumen que la vista de Reportes. */
function summaryCard(report: ReportData) {
  const { summary } = REPORT_SECTIONS;
  const people = report.byCapturista.length;
  const types = SPLIT_SERIES.map((serie) => `
    <div class="summary-row">
      <span class="dot" style="background:${COLORS[serie.colorIndex]}"></span>
      <div class="summary-label">
        <div>${serie.label}</div>
        <div class="muted small">${summary.hints[serie.key]}</div>
      </div>
      <div class="summary-value">${number(report[serie.key])}</div>
    </div>`).join("");
  return `
    <div class="card keep">
      <div class="muted small">${summary.title}</div>
      <div class="summary-total">${number(report.total)}</div>
      <div class="summary-rows">${types}</div>
      <div class="summary-people">Capturadas por <span class="strong">${number(people)}</span> ${people === 1 ? "persona" : "personas"}</div>
    </div>`;
}

export interface ReportPdfInput {
  report: ReportData;
  event?: ReportEvent;
  kind: ReportKind;
  exportedBy: string;
}

export async function buildReportHtml(input: ReportPdfInput) {
  const { report, kind, exportedBy } = input;
  const [fonts, logo] = await Promise.all([poppinsFontFaces(), logoSource()]);
  const now = new Date();
  // El estado del evento se recalcula con la hora exacta de la exportación.
  const event = input.event ? { ...input.event, status: getEventStatus(input.event, now.getTime()) } : undefined;
  const exportedAt = `${now.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}, ${now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} h`;

  // Mismas secciones y condiciones que la vista de Reportes.
  const { type, status, services, capturistas } = REPORT_SECTIONS;
  const body = report.total
    ? [
        kind === "all"
          ? donutSection(type.title, type.subtitle, SPLIT_SERIES.map((serie) => ({ key: serie.key, label: serie.label, value: report[serie.key] })))
          : "",
        splitSection(status.title, status.subtitle, report.byStatus, status.limit),
        kind !== "secretary" ? barSection(services.title, services.subtitle, report.byService, services.limit) : "",
        splitSection(capturistas.title, capturistas.subtitle, report.byCapturista, capturistas.limit),
      ].join("")
    : `<section><p class="note">No hay solicitudes registradas para los filtros seleccionados.</p></section>`;

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Reporte de solicitudes</title>
<style>
  ${fonts}
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  body { font-family: "Poppins", sans-serif; font-weight: 400; font-size: 9.5pt; line-height: 1.5; color: ${INK}; }
  table.page { width: 100%; border-collapse: collapse; }
  table.page > thead { display: table-header-group; }
  table.page > thead td, table.page > tbody > tr > td { padding: 0; }
  .page-header { display: flex; align-items: center; justify-content: space-between; padding: 0 0 18px; }
  .page-header img { height: 30px; width: auto; }
  .page-header span { font-size: 7.5pt; color: ${MUTED}; letter-spacing: 0.06em; text-transform: uppercase; }
  header { margin-bottom: 18px; }
  h1 { font-size: 20pt; font-weight: 600; margin: 0 0 2px; letter-spacing: -0.01em; }
  .subtitle { font-size: 10.5pt; color: ${MUTED}; margin: 0; }
  .export-info { font-size: 8pt; color: ${MUTED}; margin: 6px 0 0; }
  .card { background: ${SOFT}; border-radius: 14px; padding: 16px 18px; margin: 0 0 16px; }
  .card-title-row { display: flex; align-items: flex-start; gap: 10px; }
  .card-title { flex: 1; font-size: 11.5pt; font-weight: 500; }
  .badge { font-size: 7.5pt; font-weight: 500; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
  .small { font-size: 8pt; }
  .strong { font-weight: 500; color: ${INK}; }
  .event-rows { margin-top: 10px; display: flex; flex-direction: column; gap: 4px; }
  .event-notes { margin-top: 10px; }
  .summary-total { font-size: 26pt; font-weight: 500; line-height: 1.15; margin-top: 2px; }
  .summary-rows { margin-top: 14px; display: flex; flex-direction: column; gap: 12px; }
  .summary-row { display: flex; align-items: flex-start; gap: 10px; }
  .summary-row .dot { margin: 5px 0 0; }
  .summary-label { flex: 1; }
  .summary-value { font-size: 11pt; font-weight: 500; }
  .summary-people { margin-top: 14px; padding: 9px 12px; background: #ffffff; border-radius: 10px; color: ${MUTED}; }
  .charts { margin-top: 26px; }
  section { margin: 0 0 26px; }
  .keep { break-inside: avoid; page-break-inside: avoid; }
  h2 { font-size: 11.5pt; font-weight: 500; margin: 0 0 2px; break-after: avoid; page-break-after: avoid; }
  .note { font-size: 8pt; color: ${MUTED}; margin: 0 0 10px; }
  .donut { display: flex; align-items: center; gap: 28px; }
  .legend { width: 300px; border-collapse: collapse; }
  .legend td { padding: 4px 0; }
  .legend td.num { width: 48px; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; vertical-align: middle; }
  .series { display: flex; gap: 18px; font-size: 8pt; color: ${MUTED}; margin: 0 0 8px; }
  .bar-row { display: flex; align-items: center; gap: 12px; margin: 0 0 7px; }
  .bar-label { width: 38%; font-size: 8.5pt; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar-detail { white-space: normal; }
  .bar-track { flex: 1; height: 9px; background: ${TRACK}; border-radius: 4px; }
  .bar-fill { display: flex; gap: 2px; height: 9px; }
  .bar-fill span { display: block; height: 9px; border-radius: 4px; }
  .bar-value { width: 34px; text-align: right; font-size: 8.5pt; }
  .bar-detail { font-size: 7.5pt; color: ${MUTED}; }
  .num { text-align: right; white-space: nowrap; }
  .muted { color: ${MUTED}; }
  footer { margin-top: 10px; font-size: 7.5pt; color: ${MUTED}; }
</style>
</head>
<body>
<!-- El <thead> de esta tabla se repite al inicio de cada página: lleva el logo. -->
<table class="page">
<thead><tr><td>
  <div class="page-header">
    <img src="${logo}" alt="Atención Ciudadana" />
    <span>Reporte de solicitudes</span>
  </div>
</td></tr></thead>
<tbody><tr><td>
  <header>
    <h1>Reportes</h1>
    <p class="subtitle">${event ? escapeHtml(event.name) : "Todos los eventos"} · ${REPORT_KIND_LABELS[kind]}</p>
    <p class="export-info">Exportado el ${escapeHtml(exportedAt)} por ${escapeHtml(exportedBy)}</p>
  </header>
  ${event ? eventCard(event) : ""}
  ${summaryCard(report)}
  <div class="charts">${body}</div>
  <footer>Cifras al ${escapeHtml(exportedAt)}. Incluye trámites del catálogo y solicitudes de Atención de Secretaría según el filtro indicado.</footer>
</td></tr></tbody>
</table>
</body>
</html>`;
}

/** Abre la impresión del navegador con el HTML del reporte (expo-print en web solo imprime la página actual). */
function printHtmlOnWeb(html: string) {
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const doc = frame.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1000);
  };
}

export async function exportReportPdf(input: ReportPdfInput) {
  const html = await buildReportHtml(input);
  if (Platform.OS === "web") {
    printHtmlOnWeb(html);
    return;
  }
  // A4 en puntos. iOS ignora los márgenes de @page: se pasan aquí para que el
  // contenido no quede pegado al borde al saltar de página.
  const { uri } = await Print.printToFileAsync({
    html,
    width: 595,
    height: 842,
    margins: { top: 51, bottom: 51, left: 45, right: 45 },
  });
  // Nombre legible para compartir: reporte-<evento>-<fecha>.pdf
  const slug = (input.event?.name || "todos-los-eventos")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const stamp = new Date().toISOString().slice(0, 10);
  const source = new File(uri);
  const target = new File(source.parentDirectory, `reporte-${slug}-${stamp}.pdf`);
  if (target.exists) target.delete();
  await source.move(target);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(target.uri, {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
      dialogTitle: "Exportar reporte",
    });
  } else {
    await Print.printAsync({ uri: target.uri });
  }
}
