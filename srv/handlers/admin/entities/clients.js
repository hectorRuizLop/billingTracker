"use strict";

/**
 * Valida los datos del cliente antes de su creación.
 * Comprueba que el nombre y email no estén vacíos y que el email pertenezca al dominio @nubexx.com.
 * @param {import('@sap/cds').Request} req - Objeto de petición CAP
 */
async function beforeCreate(req) {
  const { name, email } = req.data;

  if (!name?.trim()) return req.error(400, "Client name is required.");

  if (!email?.trim()) return req.error(400, "Client email is required.");

  if (!email.endsWith("@nubexx.com"))
    return req.error(400, "Client email must end with @nubexx.com");
}

module.exports = { beforeCreate };
