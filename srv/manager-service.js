'use strict';

const cds      = require('@sap/cds');
const handlers = require('./handlers');

module.exports = class ManagerService extends cds.ApplicationService {

  async init() {
    this.before('CREATE', 'TimeEntries', handlers.manager.entities.timeEntries.beforeCreate);
    return super.init();
  }

};
