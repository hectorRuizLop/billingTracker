const cds = require('@sap/cds');

module.exports = class EmployeeService extends cds.ApplicationService {

  async init() {
    const db = await cds.connect.to('db');
    await super.init();
  }

};
