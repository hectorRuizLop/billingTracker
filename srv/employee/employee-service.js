const cds = require('@sap/cds');

module.exports = class EmployeeService extends cds.ApplicationService {

  async init() {
    await super.init();
  }

};
