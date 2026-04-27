"use strict";

const managerAssignments = require("../../manager/entities/project-assignments");

module.exports = {
  beforeCreate: managerAssignments.beforeCreate,
  beforeUpdate: managerAssignments.beforeUpdate,
};
