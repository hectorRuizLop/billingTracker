"use strict";

const cds = require("@sap/cds");
const { logSecurityEvent } = require("../../shared/audit-logs");

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

  return await cds.tx(async (tx) => {
    // The service projection hides deleted clients, so query the db entity directly
    const client = await tx.run(
      SELECT.one.from(Clients).where({ ID: clientId, isDeleted: true }),
    );
    if (!client) return req.error(404, "Deleted client not found");

    await tx.run(
      UPDATE(Clients)
        .set({ isDeleted: false, deletedAt: null, deletedBy: null })
        .where({ ID: clientId }),
    );

    await logSecurityEvent(req, {
      subject: "Client reactivated",
      object: { type: "my.billing.Clients", id: { ID: clientId } },
      attributes: [{ name: "isDeleted", old: true, new: false }],
    });

    return `Client ${clientId} reactivated successfully`;
  });
}

module.exports = { reactivateClient };
