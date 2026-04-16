"use strict";

const cds = require("@sap/cds");

/**
 * Reactiva un cliente que había sido marcado como eliminado.
 * Consulta directamente la entidad de base de datos para localizar el cliente eliminado,
 * ya que la proyección del servicio filtra los registros con isDeleted = true.
 * @param {import('@sap/cds').Request} req - Objeto de petición CAP con parámetro clientId
 * @returns {string} Mensaje de confirmación
 */
async function reactivateClient(req) {
  const { clientId } = req.data;
  const { Clients } = cds.entities("my.billing");

  // The service projection hides deleted clients, so query the db entity directly
  const client = await SELECT.one
    .from(Clients)
    .where({ ID: clientId, isDeleted: true });
  if (!client) return req.error(404, "Deleted client not found");

  await UPDATE(Clients)
    .set({ isDeleted: false, deletedAt: null, deletedBy: null })
    .where({ ID: clientId });

  const audit = await cds.connect.to("audit-log");
  await audit.log("SecurityEvent", {
    user: req.user.id,
    data: {
      subject: "Client reactivated",
      object: { type: "my.billing.Clients", id: { ID: clientId } },
      attributes: [{ name: "isDeleted", old: true, new: false }],
    },
  });

  return `Client ${clientId} reactivated successfully`;
}

module.exports = { reactivateClient };
