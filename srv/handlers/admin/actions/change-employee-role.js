"use strict";

const cds = require("@sap/cds");

/**
 * Cambia el rol de un empleado al valor indicado.
 * Si el nuevo rol es Manager ('M'), asigna automáticamente la categoría Lead.
 * @param {import('@sap/cds').Request} req - Objeto de petición CAP con parámetros employeeId y newRole
 * @returns {string} Mensaje de confirmación
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

  const employee = await SELECT.one.from(Employees).where({ ID: employeeId });
  if (!employee) return req.error(404, "Employee not found");

  const update = { role: newRole };

  // Promoting to Manager automatically assigns the Lead category
  if (newRole === "M") {
    const lead = await SELECT.one.from(Categories).where({ code: "L" });
    if (lead) update.category_ID = lead.ID;
  }

  await UPDATE(Employees).set(update).where({ ID: employeeId });

  // Manual audit — custom action bypasses @PersonalData auto-logging
  const audit = await cds.connect.to("audit-log");
  await audit.log("SecurityEvent", {
    user: req.user.id,
    data: {
      subject: "Employee role changed",
      object: { type: "my.billing.Employees", id: { ID: employeeId } },
      attributes: [{ name: "role", old: employee.role, new: newRole }],
    },
  });

  return `Employee role updated to ${newRole}`;
}

module.exports = { changeEmployeeRole };
