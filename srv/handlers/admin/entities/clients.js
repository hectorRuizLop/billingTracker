'use strict';

const cds = require('@sap/cds');

/**
 * Valida los datos del cliente antes de su creación.
 * Comprueba que el nombre y email no estén vacíos y que el email pertenezca al dominio @nubexx.com.
 * @param {import('@sap/cds').Request} req - Objeto de petición CAP
 */
async function beforeCreate(req) {
  const { Name, Email } = req.data;

  if (!Name?.trim())
    return req.error(400, 'Client name is required.');

  if (!Email?.trim())
    return req.error(400, 'Client email is required.');

  if (!Email.endsWith('@nubexx.com'))
    return req.error(400, 'Client email must end with @nubexx.com');
}

/**
 * Registra una entrada en el log de auditoría tras la creación exitosa de un cliente.
 * @param {object} client - Datos del cliente recién creado devueltos por CAP
 * @param {import('@sap/cds').Request} req - Objeto de petición CAP
 */
async function afterCreate(client, req) {
  const { AuditLogs } = cds.entities('my.billing');
  await INSERT.into(AuditLogs).entries({
    User:        req.user?.id ?? 'system',
    Action:      'CREATE',
    EntityName:  'Clients',
    EntityId:    client.ID,
    Field:       null,
    OldValue:    null,
    NewValue:    JSON.stringify({ Name: client.Name, Email: client.Email }),
    Description: `Client '${client.Name}' created.`,
  });
}

module.exports = { beforeCreate, afterCreate };
