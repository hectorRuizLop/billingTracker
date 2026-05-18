"use strict";

const cds = require("@sap/cds");
const { logSecurityEvent } = require("../../shared/audit-logs");

/**
Changes an employee's role to the specified value.
If the new role is Manager ('M'), it automatically assigns the Lead category.
@param {import('@sap/cds').Request} req - CAP request object with parameters employeeId and newRole
@returns {string} Confirmation message
*/
async function changeEmployeeRole(req) {
  const { employeeId, newRole } = req.data;
  const { Employees, Categories } = cds.entities("my.billing");

  const validRoles = ["E", "M", "A"];
  if (!validRoles.includes(newRole))
    return req.error(
      400,
      `Invalid role "${newRole}". Valid values: E (Employee), M (Manager), A (Admin)`,
    );

  return await cds.tx(async (tx) => {
    const employee = await tx.run(
      SELECT.one.from(Employees).where({ ID: employeeId }),
    );
    if (!employee) return req.error(404, "Employee not found");

    const update = { role: newRole };

    // Promoting to Manager automatically assigns the Lead category
    if (newRole === "M") {
      const today = new Date().toISOString().split("T")[0];
      // Resolve the Lead category effective today
      const lead = await tx.run(
        SELECT.one.from(Categories).where({
          code: "L",
          validFrom: { "<=": today },
          validTo: { ">=": today },
        }),
      );
      if (lead) update.category_ID = lead.ID;
    }

    await tx.run(UPDATE(Employees).set(update).where({ ID: employeeId }));

    // Manual audit — custom action bypasses @PersonalData auto-logging
    await logSecurityEvent(req, {
      subject: "Employee role changed",
      object: { type: "my.billing.Employees", id: { ID: employeeId } },
      attributes: [{ name: "role", old: employee.role, new: newRole }],
    });

    return `Employee role updated to ${newRole}`;
  });
}

module.exports = { changeEmployeeRole };
