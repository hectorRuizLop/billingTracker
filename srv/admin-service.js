const cds = require('@sap/cds');

module.exports = class AdminService extends cds.ApplicationService {

  async init() {
    const { AuditLog } = this.entities;

    this.before('CREATE', 'Clients', (req) => {
      const { name, email } = req.data;

      if (!name?.trim())
        return req.error(400, 'Client name is required.');

      if (!email?.trim())
        return req.error(400, 'Client email is required.');

      if (!email.endsWith('@nubexx.com'))
        return req.error(400, `Client email must end with @nubexx.com `);
    });

    this.after('CREATE', 'Clients', async (client, req) => {
      await INSERT.into(AuditLog).entries({
        user: req.user?.id ?? 'system',
        action: 'CREATE',
        entity_name: 'Clients',
        entityId: client.ID,
        field: null,
        oldValue: null,
        newValue: JSON.stringify({ name: client.name, email: client.email }),
        description: `Client '${client.name}' created.`,
      });
    });
    await super.init();
  }

};
