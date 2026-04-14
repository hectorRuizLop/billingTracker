const cds = require('@sap/cds');

module.exports = class ManagerService extends cds.ApplicationService {

  async init() {
    const db = await cds.connect.to('db');
    const { Employees, Categories } = cds.entities('my.billing');

    // Auto-fill rateSnapshot, month, year on TimeEntry creation
    this.before('CREATE', 'TimeEntries', async (req) => {
      const { employee_ID, date } = req.data;

      if (date) {
        const d = new Date(date);
        req.data.month = d.getUTCMonth() + 1;
        req.data.year  = d.getUTCFullYear();
      }

      if (employee_ID && !req.data.rateSnapshot) {
        const employee = await SELECT.one.from(Employees).where({ ID: employee_ID });
        if (employee?.category_ID) {
          const category = await SELECT.one.from(Categories).where({ ID: employee.category_ID });
          if (category?.rate) req.data.rateSnapshot = category.rate;
        }
      }
    });
    return super.init();
  }

};
