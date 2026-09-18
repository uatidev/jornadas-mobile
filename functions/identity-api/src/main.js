import fetch from "node-fetch";
import nodemailer from "nodemailer";
import { createHash } from "node:crypto";

const DATABASE_ID = "jornadas";

const findApplicantEmail = (data = {}) => {
  const entry = Object.entries(data).find(([key]) => /correo|email/i.test(key));
  const email = String(entry?.[1] || "")
    .trim()
    .toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
};

const sendRequestConfirmation = async ({
  to,
  folio,
  eventFolio,
  service,
  unit,
  event,
  requestedAt,
  attendedBy,
}) => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const fromEmail = process.env.SMTP_FROM_EMAIL;
  if (!host || !user || !password || !fromEmail)
    return { sent: false, reason: "SMTP no configurado" };

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure:
      String(process.env.SMTP_SECURE || "").toLowerCase() === "true" ||
      Number(process.env.SMTP_PORT) === 465,
    auth: { user, pass: password },
  });
  const lines = [
    "COMPROBANTE DE SOLICITUD",
    "Tu solicitud fue registrada correctamente.",
    "",
    `Folio de la solicitud: ${folio}`,
    `Folio del evento: ${eventFolio || "No aplica"}`,
    `Trámite o programa: ${service.nombre}`,
    `Tipo: ${service.tipo || "servicio"}`,
    "Estatus al momento del registro: Enviada",
    `Fecha y hora: ${requestedAt.toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}`,
    `Atendió: ${attendedBy || "Personal de atención"}`,
    "",
    "LUGAR DE ATENCIÓN",
    `Evento: ${event?.nombre || "Registro fuera de evento"}`,
    `Sede: ${event?.sede || "No especificada"}`,
    `Dirección: ${event?.direccion || "No especificada"}`,
    `Localidad y municipio: ${[event?.localidad, event?.municipio].filter(Boolean).join(", ") || "No especificados"}`,
    "",
    "UNIDAD RESPONSABLE",
    `Unidad responsable: ${unit.nombre}`,
    `Encargado del área: ${unit.titular || "No especificado"}`,
    `Correo: ${unit.correoContacto || "No especificado"}`,
    `Teléfono: ${unit.telefonoContacto || "No especificado"}${unit.extensionTelefono ? ` ext. ${unit.extensionTelefono}` : ""}`,
    "",
    "CONTACTO DEL TRÁMITE",
    `Responsable: ${service.titularResponsable || "No especificado"}`,
    `Correo: ${service.correoContacto || "No especificado"}`,
    `Teléfono: ${service.telefonoContacto || "No especificado"}${service.extensionTelefono ? ` ext. ${service.extensionTelefono}` : ""}`,
    "",
    "Conserva este correo para dar seguimiento a tu solicitud.",
  ];
  await transporter.sendMail({
    from: {
      name: process.env.SMTP_FROM_NAME || "Jornadas de Atención",
      address: fromEmail,
    },
    to,
    subject: `Solicitud registrada · ${folio}`,
    text: lines.join("\n"),
  });
  return { sent: true };
};

const sendSecretaryConfirmation = async ({ to, folio, eventFolio, subject, event, requestedAt, contact }) => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const fromEmail = process.env.SMTP_FROM_EMAIL;
  if (!host || !user || !password || !fromEmail)
    return { sent: false, reason: "SMTP no configurado" };
  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || Number(process.env.SMTP_PORT) === 465,
    auth: { user, pass: password },
  });
  await transporter.sendMail({
    from: { name: process.env.SMTP_FROM_NAME || "Jornadas de Atención", address: fromEmail },
    to,
    subject: `Atención de Secretaría registrada · ${folio}`,
    text: [
      "COMPROBANTE DE ATENCIÓN DE SECRETARÍA",
      "Tu solicitud fue registrada correctamente.",
      "",
      `Folio de la solicitud: ${folio}`,
      `Folio del evento: ${eventFolio || "No disponible"}`,
      `Asunto: ${subject}`,
      `Evento: ${event?.nombre || "No disponible"}`,
      `Sede: ${event?.sede || "No especificada"}`,
      `Fecha y hora: ${requestedAt.toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}`,
      "",
      "CONTACTO DE SECRETARÍA",
      `Responsable: ${contact?.name || "No especificado"}`,
      `Correo: ${contact?.email || "No especificado"}`,
      `Teléfono: ${contact?.phone || "No especificado"}${contact?.extension ? ` ext. ${contact.extension}` : ""}`,
      "",
      "Conserva este correo y tu folio para dar seguimiento a la solicitud.",
    ].join("\n"),
  });
  return { sent: true };
};

export default async ({ req, res, log, error }) => {
  const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT?.replace(
    /\/$/,
    "",
  );
  const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID;
  // Instalaciones antiguas de Appwrite pueden exponer la clave dinámica con
  // APPWRITE_API_KEY en lugar de APPWRITE_FUNCTION_API_KEY.
  const apiKey =
    process.env.APPWRITE_SERVER_API_KEY ||
    process.env.APPWRITE_FUNCTION_API_KEY ||
    process.env.APPWRITE_API_KEY;
  const userId = req.headers["x-appwrite-user-id"];
  const userJwt = req.headers["x-appwrite-user-jwt"];

  log(
    `runtime-auth apiKey=${Boolean(apiKey)} jwt=${Boolean(userJwt)} user=${Boolean(userId)}`,
  );
  const call = async (method, route, body, jwt) => {
    const headers = {
      "content-type": "application/json",
      "x-appwrite-project": projectId,
    };
    if (jwt) headers["x-appwrite-jwt"] = jwt;
    else headers["x-appwrite-key"] = apiKey;
    const response = await fetch(`${endpoint}${route}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok)
      throw new Error(
        `${method} ${route}: ${data.message || `Appwrite ${response.status}`}`,
      );
    return data;
  };

  const json = (status, data) => res.json(data, status);
  const nextFolioNumber = async (key) => {
    const documentId = `tramite-${key}`
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .slice(0, 36);
    try {
      const counter = await call(
        "GET",
        `/databases/${DATABASE_ID}/collections/folio_contadores/documents/${documentId}`,
      );
      const next = Number(counter.ultimo || 0) + 1;
      await call(
        "PATCH",
        `/databases/${DATABASE_ID}/collections/folio_contadores/documents/${documentId}`,
        { data: { ultimo: next } },
      );
      return next;
    } catch (cause) {
      if (!String(cause.message).toLowerCase().includes("could not be found"))
        throw cause;
      await call(
        "POST",
        `/databases/${DATABASE_ID}/collections/folio_contadores/documents`,
        {
          documentId,
          data: {
            periodo: createHash("sha1")
              .update(String(key))
              .digest("hex")
              .slice(0, 10),
            ultimo: 1,
          },
        },
      );
      return 1;
    }
  };
  if (!userId || !userJwt)
    return json(401, { message: "Se requiere una sesión válida" });

  try {
    const input =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : req.body || {};
    const account = await call("GET", "/account", undefined, userJwt);
    const user = await call("GET", `/users/${userId}`);
    const labels = user.labels || [];
    const isSuperAdmin = labels.includes("superadmin");
    const profileRoute = `/databases/${DATABASE_ID}/collections/usuarios_perfil/documents/${userId}`;

    let profile;
    try {
      profile = await call("GET", profileRoute);
    } catch (cause) {
      if (!String(cause.message).toLowerCase().includes("could not be found"))
        throw cause;
    }

    if (input.action === "ensureProfile") {
      if (profile) return json(200, profile);
      const data = {
        userId,
        email: account.email,
        nombre: account.name || account.email.split("@")[0],
        rol: "solicitante",
        rolSistema: "solicitante",
        activo: true,
      };
      profile = await call(
        "POST",
        `/databases/${DATABASE_ID}/collections/usuarios_perfil/documents`,
        {
          documentId: userId,
          data,
          permissions: [
            `read(\"user:${userId}\")`,
            `update(\"user:${userId}\")`,
            `read(\"label:superadmin\")`,
            `update(\"label:superadmin\")`,
          ],
        },
      );
      if (!labels.includes("solicitante"))
        await call("PUT", `/users/${userId}/labels`, {
          labels: [...labels, "solicitante"],
        });
      return json(201, profile);
    }

    if (!profile?.activo)
      return json(403, { message: "La cuenta no tiene un perfil activo" });

    if (input.action === "saveAdministrativeUnit") {
      if (!isSuperAdmin || profile.rol !== "super_admin")
        return json(403, { message: "Acceso exclusivo de superadministración" });
      const code = String(input.code || "").trim().toUpperCase();
      const name = String(input.name || "").trim();
      if (!code || !name)
        return json(400, { message: "Captura la clave y el nombre de la unidad" });

      if (input.id) {
        const current = await call(
          "GET",
          `/databases/${DATABASE_ID}/collections/unidades_administrativas/documents/${input.id}`,
        );
        const updated = await call(
          "PATCH",
          `/databases/${DATABASE_ID}/collections/unidades_administrativas/documents/${input.id}`,
          {
            data: {
              clave: code,
              nombre: name,
              descripcion: String(input.description || "").trim() || null,
              titular: String(input.contactName || "").trim() || null,
              correoContacto: String(input.contactEmail || "").trim().toLowerCase() || null,
              telefonoContacto: String(input.contactPhone || "").trim() || null,
              extensionTelefono: String(input.contactExtension || "").trim() || null,
              activo: input.active !== false,
            },
          },
        );
        if (current.teamId)
          await call("PUT", `/teams/${current.teamId}`, { name });
        return json(200, updated);
      }

      const teamId = `unidad-${code.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`.slice(0, 36);
      const team = await call("POST", "/teams", { teamId, name });
      try {
        const created = await call(
          "POST",
          `/databases/${DATABASE_ID}/collections/unidades_administrativas/documents`,
          {
            documentId: "unique()",
            data: {
              clave: code,
              nombre: name,
              descripcion: String(input.description || "").trim() || null,
              titular: String(input.contactName || "").trim() || null,
              correoContacto: String(input.contactEmail || "").trim().toLowerCase() || null,
              telefonoContacto: String(input.contactPhone || "").trim() || null,
              extensionTelefono: String(input.contactExtension || "").trim() || null,
              teamId: team.$id,
              activo: input.active !== false,
            },
          },
        );
        return json(201, created);
      } catch (cause) {
        await call("DELETE", `/teams/${team.$id}`);
        throw cause;
      }
    }

    const mapSecretaryRequest = (item) => {
      const parse = (value, fallback) => {
        try { return JSON.parse(value || ""); } catch { return fallback; }
      };
      return {
        id: item.$id,
        folio: item.folio,
        applicantData: parse(item.datosSolicitante, {}),
        subject: item.asunto,
        source: item.procedencia,
        officeNumber: item.numeroOficio,
        officeDate: item.fechaOficio,
        notes: item.observaciones,
        route: item.rutaAtencion,
        status: item.estatus,
        capturedByUserId: item.capturadoPorUserId,
        capturedByName: item.capturadoPorNombre,
        capturedOnBehalfOfSecretary: Boolean(item.capturadoEnNombreDeSecretaria),
        highPriority: Boolean(item.prioridadAlta),
        responsibleUnitId: item.unidadResponsableId,
        eventId: item.eventoAtencionId,
        eventFolio: item.folioEvento,
        documents: parse(item.documentos, []),
        createdAt: item.fechaRegistro,
        updatedAt: item.fechaActualizacion,
      };
    };

    if (input.action === "servicePopularity") {
      const result = await call("GET", `/databases/${DATABASE_ID}/collections/solicitudes/documents?total=false&queries[]=${encodeURIComponent(JSON.stringify({ method: "limit", values: [5000] }))}`);
      const counts = (result.documents || []).reduce((summary, request) => {
        const serviceId = request.tramiteServicioId;
        if (serviceId) summary[serviceId] = (summary[serviceId] || 0) + 1;
        return summary;
      }, {});
      return json(200, { counts });
    }

    if (input.action === "submitSecretaryRequest") {
      if (!isSuperAdmin && !["secretaria", "capturista_secretaria", "enlace"].includes(profile.rolSistema))
        return json(403, { message: "Solo Secretaria, Representante de la Titular o Enlace de canalización pueden registrar esta solicitud" });
      if (!String(input.subject || "").trim()) return json(400, { message: "El asunto es obligatorio" });
      if (!["gobernador", "oficina_gubernamental", "otra"].includes(input.source))
        return json(400, { message: "Selecciona una procedencia válida" });
      if (!["secretaria", "canalizacion"].includes(input.route))
        return json(400, { message: "Selecciona quién atenderá la solicitud" });
      if (!String(input.eventId || "").trim())
        return json(400, { message: "Selecciona un evento de atención" });
      const stamp = new Date().toISOString();
      const event = await call("GET", `/databases/${DATABASE_ID}/collections/eventos_atencion/documents/${input.eventId}`);
      const now = new Date(stamp).getTime();
      if (!event.activo || now < new Date(event.fechaInicio).getTime() || now > new Date(event.fechaFin).getTime())
        return json(409, { message: "El evento de atención ya no está activo" });
      const folioNumber = await nextFolioNumber("solicitud-secretaria");
      const folio = `SEC-${String(folioNumber).padStart(6, "0")}`;
      const permissions = [
        `read(\"label:superadmin\")`, `update(\"label:superadmin\")`,
        `read(\"label:secretaria\")`, `update(\"label:secretaria\")`,
        `read(\"label:capturistasecretaria\")`, `update(\"label:capturistasecretaria\")`,
        `read(\"label:enlace\")`, `update(\"label:enlace\")`,
      ];
      const created = await call("POST", `/databases/${DATABASE_ID}/collections/solicitudes_secretaria/documents`, {
        documentId: "unique()",
        permissions,
        data: {
          folio,
          datosSolicitante: JSON.stringify(input.applicantData || {}),
          asunto: String(input.subject).trim(),
          procedencia: input.source,
          ...(input.officeNumber ? { numeroOficio: String(input.officeNumber).trim() } : {}),
          ...(input.officeDate ? { fechaOficio: new Date(input.officeDate).toISOString() } : {}),
          ...(input.notes ? { observaciones: String(input.notes).trim() } : {}),
          rutaAtencion: input.route,
          estatus: input.route === "secretaria" ? "recibida" : "pendiente_canalizacion",
          capturadoPorUserId: userId,
          capturadoPorNombre: profile.nombre || account.name || account.email,
          capturadoEnNombreDeSecretaria: ["capturista_secretaria", "enlace"].includes(profile.rolSistema),
          prioridadAlta: true,
          eventoAtencionId: event.$id,
          folioEvento: event.prefijoFolio || event.claveMunicipio,
          documentos: JSON.stringify(Array.isArray(input.documents) ? input.documents : []),
          fechaRegistro: stamp,
          fechaActualizacion: stamp,
        },
      });
      const suppliedRecipient = String(input.recipientEmail || "").trim().toLowerCase();
      const recipient = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(suppliedRecipient)
        ? suppliedRecipient
        : findApplicantEmail(input.applicantData);
      let secretaryContact = {};
      try {
        const formConfigurations = await call("GET", `/databases/${DATABASE_ID}/collections/configuracion_formulario_global/documents?total=false&queries[]=${encodeURIComponent(JSON.stringify({ method: "limit", values: [100] }))}`);
        const activeFormConfiguration = (formConfigurations.documents || [])
          .filter((item) => item.activo)
          .sort((a, b) => Number(b.version || 0) - Number(a.version || 0))[0];
        secretaryContact = JSON.parse(activeFormConfiguration?.campos || "{}").secretaryContact || {};
      } catch {
        secretaryContact = {};
      }
      let emailResult = { sent: false, reason: recipient ? "No se intentó el envío" : "La solicitud no contiene un correo válido" };
      if (recipient) {
        try {
          emailResult = await sendSecretaryConfirmation({
            to: recipient,
            folio,
            eventFolio: event.prefijoFolio || event.claveMunicipio,
            subject: String(input.subject).trim(),
            event,
            requestedAt: new Date(stamp),
            contact: secretaryContact,
          });
        } catch (cause) {
          emailResult = { sent: false, reason: cause.message || "No fue posible enviar el correo" };
          error(`secretary-email-confirmation ${folio}: ${emailResult.reason}`);
        }
      }
      return json(201, {
        request: mapSecretaryRequest(created),
        emailSent: emailResult.sent,
        emailMessage: emailResult.sent ? "Comprobante enviado por correo" : emailResult.reason,
      });
    }

    if (input.action === "listSecretaryRequests") {
      if (!isSuperAdmin && !["secretaria", "capturista_secretaria", "enlace", "gestor"].includes(profile.rolSistema))
        return json(403, { message: "No tienes acceso a solicitudes de Secretaria" });
      const result = await call("GET", `/databases/${DATABASE_ID}/collections/solicitudes_secretaria/documents?total=false&queries[]=${encodeURIComponent(JSON.stringify({ method: "limit", values: [500] }))}`);
      let requests = result.documents || [];
      if (profile.rolSistema === "enlace")
        requests = requests.filter((item) => ["canalizacion", "canalizada"].includes(item.rutaAtencion));
      if (profile.rolSistema === "gestor")
        requests = requests.filter((item) => item.unidadResponsableId === profile.unidadAdministrativaId);
      requests.sort((a, b) => new Date(b.fechaRegistro).getTime() - new Date(a.fechaRegistro).getTime());
      return json(200, { requests: requests.map(mapSecretaryRequest) });
    }

    if (input.action === "listMySecretaryRequests") {
      if (!isSuperAdmin && !["secretaria", "capturista_secretaria", "enlace", "gestor"].includes(profile.rolSistema))
        return json(403, { message: "No tienes acceso a solicitudes de Secretaria" });
      const result = await call("GET", `/databases/${DATABASE_ID}/collections/solicitudes_secretaria/documents?total=false&queries[]=${encodeURIComponent(JSON.stringify({ method: "limit", values: [500] }))}`);
      const requests = (result.documents || [])
        .filter((item) => item.capturadoPorUserId === userId)
        .sort((a, b) => new Date(b.fechaRegistro).getTime() - new Date(a.fechaRegistro).getTime());
      return json(200, { requests: requests.map(mapSecretaryRequest) });
    }

    if (input.action === "updateSecretaryRequest") {
      if (!isSuperAdmin && !["secretaria", "capturista_secretaria", "enlace", "gestor"].includes(profile.rolSistema))
        return json(403, { message: "No tienes permisos para actualizar esta solicitud" });
      const current = await call("GET", `/databases/${DATABASE_ID}/collections/solicitudes_secretaria/documents/${input.requestId}`);
      const data = { fechaActualizacion: new Date().toISOString() };
      let permissions;
      if (input.unitId) {
        if (!isSuperAdmin && profile.rolSistema !== "enlace")
          return json(403, { message: "Solo el Enlace puede definir el área responsable" });
        const unit = await call("GET", `/databases/${DATABASE_ID}/collections/unidades_administrativas/documents/${input.unitId}`);
        data.unidadResponsableId = unit.$id;
        data.rutaAtencion = "canalizada";
        data.estatus = "canalizada";
        data.observaciones = String(input.comment || `Canalizada a ${unit.nombre}`).trim();
        permissions = [
          `read(\"label:superadmin\")`, `update(\"label:superadmin\")`,
          `read(\"label:secretaria\")`, `update(\"label:secretaria\")`,
          `read(\"label:capturistasecretaria\")`, `update(\"label:capturistasecretaria\")`,
          `read(\"label:enlace\")`, `update(\"label:enlace\")`,
          `read(\"team:${unit.teamId}\")`, `update(\"team:${unit.teamId}\")`,
        ];
      } else if (input.status) {
        const allowed = ["recibida", "en_atencion", "requiere_informacion", "atendida", "cancelada"];
        if (!allowed.includes(input.status)) return json(400, { message: "Estatus no permitido" });
        const directRequest = current.rutaAtencion === "secretaria";
        if (input.status === "atendida" && directRequest && !isSuperAdmin && profile.rolSistema !== "secretaria")
          return json(403, { message: "El cierre definitivo corresponde a Secretaria" });
        if (profile.rolSistema === "gestor" && current.unidadResponsableId !== profile.unidadAdministrativaId)
          return json(403, { message: "La solicitud no pertenece a tu área" });
        data.estatus = input.status;
        if (input.comment) data.observaciones = String(input.comment).trim();
      }
      const updated = await call("PATCH", `/databases/${DATABASE_ID}/collections/solicitudes_secretaria/documents/${current.$id}`, {
        data,
        ...(permissions ? { permissions } : {}),
      });
      return json(200, { request: mapSecretaryRequest(updated) });
    }

    if (input.action === "submitRequest") {
      if (
        !isSuperAdmin &&
        !["capturista", "capturista_secretaria", "gestor", "enlace", "secretaria"].includes(
          profile.rolSistema,
        )
      )
        return json(403, {
          message: "Tu perfil no tiene permisos para generar solicitudes",
        });
      const service = await call(
        "GET",
        `/databases/${DATABASE_ID}/collections/tramites_servicios/documents/${input.serviceId}`,
      );
      const now = Date.now();
      const canChoosePriority = ["secretaria", "capturista_secretaria", "enlace"].includes(
        profile.rolSistema,
      );
      const institutionalPriority = ["secretaria", "capturista_secretaria"].includes(
        profile.rolSistema,
      );
      const priorityOnReopening =
        institutionalPriority ||
        (canChoosePriority && input.priority === true) ||
        !service.activo ||
        (service.vigenciaInicio && now < new Date(service.vigenciaInicio).getTime()) ||
        (service.vigenciaFin && now > new Date(service.vigenciaFin).getTime());
      const unit = await call(
        "GET",
        `/databases/${DATABASE_ID}/collections/unidades_administrativas/documents/${service.unidadAdministrativaId}`,
      );
      const stamp = new Date();
      let event;
      if (input.eventId) {
        event = await call(
          "GET",
          `/databases/${DATABASE_ID}/collections/eventos_atencion/documents/${input.eventId}`,
        );
        if (
          !event.activo ||
          now < new Date(event.fechaInicio).getTime() ||
          now > new Date(event.fechaFin).getTime()
        )
          return json(409, {
            message: "El evento de atención ya no está activo",
          });
      } else {
        const result = await call(
          "GET",
          `/databases/${DATABASE_ID}/collections/eventos_atencion/documents?total=false&queries[]=${encodeURIComponent(JSON.stringify({ method: "limit", values: [100] }))}`,
        );
        event = (result.documents || []).find(
          (item) =>
            item.activo &&
            now >= new Date(item.fechaInicio).getTime() &&
            now <= new Date(item.fechaFin).getTime(),
        );
      }
      if (!event)
        return json(409, {
          message: "Se requiere seleccionar un evento de atención activo para registrar la solicitud",
        });
      const eventFolio = event
        ? event.prefijoFolio || event.claveMunicipio
        : undefined;
      const folioNumber = await nextFolioNumber(service.$id);
      const programFolio = `${service.prefijoFolioPrograma || service.clave}-${String(folioNumber).padStart(6, "0")}`;
      const folio = programFolio;
      const permissions = [
        `read(\"user:${userId}\")`,
        `update(\"user:${userId}\")`,
        `read(\"team:${unit.teamId}\")`,
        `update(\"team:${unit.teamId}\")`,
        `read(\"label:superadmin\")`,
        `update(\"label:superadmin\")`,
        `read(\"label:secretaria\")`,
        `read(\"label:capturistasecretaria\")`,
        `read(\"label:enlace\")`,
        `update(\"label:enlace\")`,
      ];
      const request = await call(
        "POST",
        `/databases/${DATABASE_ID}/collections/solicitudes/documents`,
        {
          documentId: "unique()",
          permissions,
          data: {
            folio,
            tramiteServicioId: service.$id,
            unidadAdministrativaId: unit.$id,
            solicitanteUserId: userId,
            estatus: "enviada",
            datosSolicitante: JSON.stringify(input.applicantData || {}),
            datosTramite: JSON.stringify(input.requestData || {}),
            fechaSolicitud: stamp.toISOString(),
            eventoAtencionId: event.$id,
            folioEvento: eventFolio,
            ...(programFolio ? { folioPrograma: programFolio } : {}),
            prioridadReapertura: Boolean(priorityOnReopening),
            ...(priorityOnReopening
              ? { observaciones: "Solicitud registrada con prioridad" }
              : {}),
          },
        },
      );
      await call(
        "POST",
        `/databases/${DATABASE_ID}/collections/historial_solicitud/documents`,
        {
          documentId: "unique()",
          permissions,
          data: {
            solicitudId: request.$id,
            estatusNuevo: "enviada",
            comentario: "Solicitud registrada",
            realizadoPorUserId: userId,
            fecha: stamp.toISOString(),
          },
        },
      );
      const suppliedRecipient = String(input.recipientEmail || "").trim().toLowerCase();
      const recipient = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(suppliedRecipient)
        ? suppliedRecipient
        : findApplicantEmail(input.applicantData);
      let emailResult = {
        sent: false,
        reason: recipient
          ? "No se intentó el envío"
          : "La solicitud no contiene un correo válido",
      };
      if (recipient) {
        try {
          emailResult = await sendRequestConfirmation({
            to: recipient,
            folio,
            eventFolio,
            service,
            unit,
            event,
            requestedAt: stamp,
            attendedBy: profile.nombre || account.name || account.email,
          });
        } catch (cause) {
          emailResult = {
            sent: false,
            reason: cause.message || "No fue posible enviar el correo",
          };
          error(`email-confirmation ${folio}: ${emailResult.reason}`);
        }
      }
      return json(201, {
        id: request.$id,
        folio,
        eventFolio,
        programFolio,
        status: request.estatus,
        priorityOnReopening: Boolean(priorityOnReopening),
        emailSent: emailResult.sent,
        emailMessage: emailResult.sent
          ? "Confirmación enviada por correo"
          : emailResult.reason,
        receipt: {
          serviceName: service.nombre,
          serviceType: service.tipo,
          status: request.estatus,
          requestedAt: stamp.toISOString(),
          attendedBy: profile.nombre || account.name || account.email,
          unitName: unit.nombre,
          unitContactName: unit.titular,
          unitContactEmail: unit.correoContacto,
          unitContactPhone: unit.telefonoContacto,
          unitContactExtension: unit.extensionTelefono,
          serviceContactName: service.titularResponsable,
          serviceContactEmail: service.correoContacto,
          serviceContactPhone: service.telefonoContacto,
          serviceContactExtension: service.extensionTelefono,
          eventName: event.nombre,
          eventVenue: event.sede,
          eventAddress: event.direccion,
          eventLocality: event.localidad,
          eventMunicipality: event.municipio,
        },
      });
    }

    if (input.action === "finishEvent") {
      if (!isSuperAdmin || profile.rol !== "super_admin")
        return json(403, { message: "Acceso exclusivo de superadministracion" });
      const updated = await call(
        "PATCH",
        `/databases/${DATABASE_ID}/collections/eventos_atencion/documents/${input.eventId}`,
        { data: { activo: false, fechaFin: new Date().toISOString() } },
      );
      return json(200, updated);
    }

    if (input.action === "reportingStaff") {
      if (
        !isSuperAdmin &&
        !["secretaria", "gestor", "enlace"].includes(profile.rolSistema)
      )
        return json(403, { message: "No tienes permisos para consultar reportes" });
      const result = await call(
        "GET",
        `/databases/${DATABASE_ID}/collections/usuarios_perfil/documents?total=false&queries[]=${encodeURIComponent(JSON.stringify({ method: "limit", values: [500] }))}`,
      );
      return json(200, {
        staff: (result.documents || []).map((item) => ({
          id: item.userId || item.$id,
          name: item.nombre,
          role: item.rolSistema || item.rol,
          unitId: item.unidadAdministrativaId,
        })),
      });
    }

    if (input.action === "requestReassignment") {
      if (
        !isSuperAdmin &&
        profile.rol !== "enlace" &&
        profile.rolSistema !== "gestor"
      )
        return json(403, { message: "No tienes permisos para solicitar una reasignacion" });
      if (!String(input.reason || "").trim())
        return json(400, { message: "Debes indicar por que el tramite no aplica" });
      const request = await call(
        "GET",
        `/databases/${DATABASE_ID}/collections/solicitudes/documents/${input.requestId}`,
      );
      if (
        !isSuperAdmin &&
        request.unidadAdministrativaId !== profile.unidadAdministrativaId
      )
        return json(403, { message: "La solicitud pertenece a otra unidad" });
      const updated = await call(
        "PATCH",
        `/databases/${DATABASE_ID}/collections/solicitudes/documents/${request.$id}`,
        {
          data: {
            estatus: "requiere_informacion",
            datosTramite: JSON.stringify({
              ...(() => { try { return JSON.parse(request.datosTramite || "{}"); } catch { return {}; } })(),
              __seguimiento: {
                ...(() => { try { return JSON.parse(request.datosTramite || "{}").__seguimiento || {}; } catch { return {}; } })(),
                requiereReasignacion: true,
                motivoReasignacion: String(input.reason).trim(),
                unidadAnteriorId: request.unidadAdministrativaId,
                reasignacionSolicitadaEn: new Date().toISOString(),
              },
            }),
            observaciones: String(input.reason).trim(),
          },
        },
      );
      await call(
        "POST",
        `/databases/${DATABASE_ID}/collections/historial_solicitud/documents`,
        {
          documentId: "unique()",
          permissions: request.$permissions,
          data: {
            solicitudId: request.$id,
            estatusAnterior: request.estatus,
            estatusNuevo: "requiere_informacion",
            comentario: `No aplica en la unidad actual. Reasignacion solicitada: ${String(input.reason).trim()}`,
            realizadoPorUserId: userId,
            fecha: new Date().toISOString(),
          },
        },
      );
      return json(200, updated);
    }

    if (input.action === "listReassignmentQueue") {
      if (!isSuperAdmin && profile.rolSistema !== "enlace")
        return json(403, { message: "Acceso exclusivo de enlaces" });
      const result = await call(
        "GET",
        `/databases/${DATABASE_ID}/collections/solicitudes/documents?total=false&queries[]=${encodeURIComponent(JSON.stringify({ method: "limit", values: [500] }))}`,
      );
      const pending = (result.documents || []).filter((item) => {
        try {
          return item.requiereReasignacion || JSON.parse(item.datosTramite || "{}").__seguimiento?.requiereReasignacion;
        } catch { return Boolean(item.requiereReasignacion); }
      });
      return json(200, {
        requests: pending.map((item) => ({
          id: item.$id,
          folio: item.folio,
          serviceId: item.tramiteServicioId,
          unitId: item.unidadAdministrativaId,
          applicantUserId: item.solicitanteUserId,
          status: item.estatus,
          requestedAt: item.fechaSolicitud,
          notes: item.observaciones,
          eventId: item.eventoAtencionId,
          eventFolio: item.folioEvento,
          programFolio: item.folioPrograma,
          reassignmentRequired: true,
          reassignmentReason: item.motivoReasignacion || (() => { try { return JSON.parse(item.datosTramite || "{}").__seguimiento?.motivoReasignacion; } catch { return undefined; } })(),
          previousUnitId: item.unidadAnteriorId || (() => { try { return JSON.parse(item.datosTramite || "{}").__seguimiento?.unidadAnteriorId; } catch { return undefined; } })(),
          applicantData: (() => { try { return JSON.parse(item.datosSolicitante || "{}"); } catch { return {}; } })(),
          requestData: (() => { try { return JSON.parse(item.datosTramite || "{}"); } catch { return {}; } })(),
        })),
      });
    }

    if (input.action === "canalizationReport") {
      if (!isSuperAdmin && profile.rolSistema !== "enlace")
        return json(403, { message: "Acceso exclusivo de enlaces de canalización" });
      const result = await call(
        "GET",
        `/databases/${DATABASE_ID}/collections/solicitudes/documents?total=false&queries[]=${encodeURIComponent(JSON.stringify({ method: "limit", values: [500] }))}`,
      );
      const items = (result.documents || []).flatMap((item) => {
        let tracking = {};
        try { tracking = JSON.parse(item.datosTramite || "{}").__seguimiento || {}; } catch {}
        if (!tracking.unidadAnteriorId && !tracking.requiereReasignacion) return [];
        return [{
          id: item.$id,
          folio: item.folio,
          serviceId: item.tramiteServicioId,
          previousUnitId: tracking.unidadAnteriorId,
          destinationUnitId: tracking.requiereReasignacion ? null : item.unidadAdministrativaId,
          reason: tracking.motivoReasignacion || item.observaciones,
          requestedAt: tracking.reasignacionSolicitadaEn || item.fechaSolicitud,
          resolvedAt: tracking.reasignadoEn || null,
          resolvedByUserId: tracking.reasignadoPorUserId || null,
          pending: Boolean(tracking.requiereReasignacion),
        }];
      });
      return json(200, { items });
    }

    if (input.action === "reassignRequest") {
      if (!isSuperAdmin && profile.rolSistema !== "enlace")
        return json(403, { message: "Acceso exclusivo de enlaces" });
      const request = await call(
        "GET",
        `/databases/${DATABASE_ID}/collections/solicitudes/documents/${input.requestId}`,
      );
      const unit = await call(
        "GET",
        `/databases/${DATABASE_ID}/collections/unidades_administrativas/documents/${input.unitId}`,
      );
      if (request.unidadAdministrativaId === unit.$id)
        return json(400, { message: "Selecciona una unidad diferente" });
      const permissions = (request.$permissions || []).filter(
        (permission) => !permission.includes("team:"),
      );
      permissions.push(`read(\"team:${unit.teamId}\")`, `update(\"team:${unit.teamId}\")`);
      const updated = await call(
        "PATCH",
        `/databases/${DATABASE_ID}/collections/solicitudes/documents/${request.$id}`,
        {
          data: {
            unidadAdministrativaId: unit.$id,
            estatus: "enviada",
            datosTramite: JSON.stringify({
              ...(() => { try { return JSON.parse(request.datosTramite || "{}"); } catch { return {}; } })(),
              __seguimiento: {
                ...(() => { try { return JSON.parse(request.datosTramite || "{}").__seguimiento || {}; } catch { return {}; } })(),
                requiereReasignacion: false,
                reasignadoPorUserId: userId,
                reasignadoEn: new Date().toISOString(),
                unidadDestinoId: unit.$id,
                notaCanalizacion: input.comment || `Reasignada a ${unit.nombre}`,
              },
            }),
            observaciones: input.comment || `Reasignada a ${unit.nombre}`,
          },
          permissions,
        },
      );
      await call(
        "POST",
        `/databases/${DATABASE_ID}/collections/historial_solicitud/documents`,
        {
          documentId: "unique()",
          permissions,
          data: {
            solicitudId: request.$id,
            estatusAnterior: request.estatus,
            estatusNuevo: "enviada",
            comentario: input.comment || `Solicitud canalizada a ${unit.nombre}`,
            realizadoPorUserId: userId,
            fecha: new Date().toISOString(),
          },
        },
      );
      return json(200, updated);
    }

    if (input.action === "updateStaffUser") {
      if (!isSuperAdmin || profile.rol !== "super_admin")
        return json(403, { message: "Acceso exclusivo de superadministración" });
      if (!String(input.email || "").toLowerCase().endsWith("@tabasco.gob.mx"))
        return json(400, { message: "El usuario debe usar un correo @tabasco.gob.mx" });
      if (!["super_admin", "secretaria", "capturista_secretaria", "enlace", "gestor", "capturista"].includes(input.role))
        return json(400, { message: "Rol institucional no permitido" });
      if (input.id === userId)
        return json(400, { message: "No puedes modificar tu propio superadministrador desde esta vista" });
      const nextPassword = String(input.password || "");
      if (nextPassword && (nextPassword.length < 8 || nextPassword.length > 256))
        return json(400, { message: "La nueva contraseña debe tener entre 8 y 256 caracteres" });
      const requiresUnit = ["gestor", "capturista"].includes(input.role);
      if (requiresUnit && !input.unitId)
        return json(400, { message: "Debes seleccionar una unidad administrativa" });
      const targetProfile = await call("GET", `/databases/${DATABASE_ID}/collections/usuarios_perfil/documents/${input.id}`);
      const targetUser = await call("GET", `/users/${input.id}`);
      const oldUnit = targetProfile.unidadAdministrativaId
        ? await call("GET", `/databases/${DATABASE_ID}/collections/unidades_administrativas/documents/${targetProfile.unidadAdministrativaId}`)
        : null;
      const newUnit = requiresUnit
        ? await call("GET", `/databases/${DATABASE_ID}/collections/unidades_administrativas/documents/${input.unitId}`)
        : null;
      if (oldUnit && (input.role !== "gestor" || oldUnit.$id !== newUnit?.$id)) {
        const memberships = await call("GET", `/teams/${oldUnit.teamId}/memberships?total=false`);
        const membership = (memberships.memberships || []).find((item) => item.userId === input.id);
        if (membership) await call("DELETE", `/teams/${oldUnit.teamId}/memberships/${membership.$id}`);
      }
      if (input.role === "gestor" && newUnit) {
        const newMemberships = await call("GET", `/teams/${newUnit.teamId}/memberships?total=false`);
        const alreadyMember = (newMemberships.memberships || []).some((item) => item.userId === input.id);
        if (!alreadyMember)
          await call("POST", `/teams/${newUnit.teamId}/memberships`, { roles: ["member"], userId: input.id });
      }
      const nextName = String(input.name).trim();
      const nextEmail = String(input.email).trim().toLowerCase();
      if (nextName !== String(targetUser.name || "").trim())
        await call("PATCH", `/users/${input.id}/name`, { name: nextName });
      if (nextEmail !== String(targetUser.email || "").trim().toLowerCase())
        await call("PATCH", `/users/${input.id}/email`, { email: nextEmail });
      if (nextPassword)
        await call("PATCH", `/users/${input.id}/password`, { password: nextPassword });
      await call("PATCH", `/users/${input.id}/status`, { status: input.active !== false });
      await call("PUT", `/users/${input.id}/labels`, {
        labels: [input.role === "super_admin" ? "superadmin" : input.role === "capturista_secretaria" ? "capturistasecretaria" : input.role],
      });
      const updated = await call("PATCH", `/databases/${DATABASE_ID}/collections/usuarios_perfil/documents/${input.id}`, {
        data: {
          email: nextEmail,
          nombre: nextName,
          rol: ["secretaria", "capturista_secretaria", "capturista", "gestor"].includes(input.role) ? "enlace" : input.role,
          rolSistema: input.role,
          unidadAdministrativaId: newUnit?.$id || null,
          activo: input.active !== false,
        },
      });
      return json(200, updated);
    }

    if (input.action === "createStaffUser") {
      if (!isSuperAdmin || profile.rol !== "super_admin")
        return json(403, {
          message: "Acceso exclusivo de superadministración",
        });
      if (
        !String(input.email || "")
          .toLowerCase()
          .endsWith("@tabasco.gob.mx")
      )
        return json(400, {
          message: "El usuario debe usar un correo @tabasco.gob.mx",
        });
      if (!["super_admin", "secretaria", "capturista_secretaria", "enlace", "gestor", "capturista"].includes(input.role))
        return json(400, { message: "Rol institucional no permitido" });
      const requiresUnit = ["gestor", "capturista"].includes(input.role);
      if (requiresUnit && !input.unitId)
        return json(400, { message: "Debes seleccionar una unidad administrativa" });
      const unit = requiresUnit
        ? await call(
            "GET",
            `/databases/${DATABASE_ID}/collections/unidades_administrativas/documents/${input.unitId}`,
          )
        : null;
      const created = await call("POST", "/users", {
        userId: "unique()",
        email: input.email,
        password: input.password,
        name: input.name,
      });
      await call("PUT", `/users/${created.$id}/labels`, {
        labels: [input.role === "super_admin" ? "superadmin" : input.role === "capturista_secretaria" ? "capturistasecretaria" : input.role],
      });
      if (unit && input.role === "gestor")
        await call("POST", `/teams/${unit.teamId}/memberships`, {
          roles: ["member"],
          userId: created.$id,
        });
      const staffProfile = await call(
        "POST",
        `/databases/${DATABASE_ID}/collections/usuarios_perfil/documents`,
        {
          documentId: created.$id,
          permissions: [
            `read(\"user:${created.$id}\")`,
            `read(\"label:superadmin\")`,
            `update(\"label:superadmin\")`,
          ],
          data: {
            userId: created.$id,
            email: created.email,
            nombre: created.name,
            rol: ["secretaria", "capturista_secretaria", "capturista", "gestor"].includes(input.role)
              ? "enlace"
              : input.role,
            rolSistema: input.role,
            ...(unit ? { unidadAdministrativaId: unit.$id } : {}),
            activo: true,
          },
        },
      );
      return json(201, staffProfile);
    }

    if (input.action === "updateStatus") {
      if (
        !isSuperAdmin &&
        profile.rol !== "enlace" &&
        profile.rolSistema !== "gestor"
      )
        return json(403, {
          message: "No tienes permisos para atender solicitudes",
        });
      const request = await call(
        "GET",
        `/databases/${DATABASE_ID}/collections/solicitudes/documents/${input.requestId}`,
      );
      if (
        !isSuperAdmin &&
        request.unidadAdministrativaId !== profile.unidadAdministrativaId
      )
        return json(403, { message: "La solicitud pertenece a otra unidad" });
      const allowed = [
        "recibida",
        "en_revision",
        "requiere_informacion",
        "aprobada",
        "rechazada",
        "cancelada",
        "concluida",
      ];
      if (!allowed.includes(input.status))
        return json(400, { message: "Estatus no permitido" });
      if (
        ["rechazada", "cancelada"].includes(input.status) &&
        !String(input.discontinuationReason || input.comment || "").trim()
      )
        return json(400, {
          message: "Indica el motivo por el que la solicitud no continuo",
        });
      if (
        input.status === "concluida" &&
        typeof input.receivedBenefit !== "boolean"
      )
        return json(400, {
          message: "Indica si la persona recibio el apoyo o tramite",
        });
      let requestData = {};
      try {
        requestData = JSON.parse(request.datosTramite || "{}");
      } catch {
        requestData = {};
      }
      const tracking = {
        ...(requestData.__seguimiento || {}),
        resultadoFinal: input.finalResult || null,
        motivoNoContinuidad: input.discontinuationReason || null,
        apoyoRecibido:
          typeof input.receivedBenefit === "boolean"
            ? input.receivedBenefit
            : null,
        detalleBeneficio: input.benefitDetail || null,
      };
      const baseData = {
        estatus: input.status,
        observaciones: input.comment || null,
        datosTramite: JSON.stringify({ ...requestData, __seguimiento: tracking }),
      };
      let updated;
      try {
        updated = await call(
          "PATCH",
          `/databases/${DATABASE_ID}/collections/solicitudes/documents/${request.$id}`,
          {
            data: {
              ...baseData,
              resultadoFinal: tracking.resultadoFinal,
              motivoNoContinuidad: tracking.motivoNoContinuidad,
              ...(typeof input.receivedBenefit === "boolean"
                ? { apoyoRecibido: input.receivedBenefit }
                : {}),
            },
          },
        );
      } catch (cause) {
        // Compatibilidad temporal con instalaciones que todavía no tienen los
        // atributos nuevos: el resultado permanece en datosTramite.
        updated = await call(
          "PATCH",
          `/databases/${DATABASE_ID}/collections/solicitudes/documents/${request.$id}`,
          { data: baseData },
        );
      }
      await call(
        "POST",
        `/databases/${DATABASE_ID}/collections/historial_solicitud/documents`,
        {
          documentId: "unique()",
          permissions: request.$permissions,
          data: {
            solicitudId: request.$id,
            estatusAnterior: request.estatus,
            estatusNuevo: input.status,
            comentario: input.comment || null,
            realizadoPorUserId: userId,
            fecha: new Date().toISOString(),
          },
        },
      );
      return json(200, updated);
    }

    return json(400, { message: "Acción no reconocida" });
  } catch (cause) {
    error(cause.stack || cause.message);
    return json(500, { message: cause.message || "Error interno" });
  }
};
