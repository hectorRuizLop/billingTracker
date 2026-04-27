"use strict";

const managerProjects = require("../../manager/entities/projects");

module.exports = {
  beforeUpdate: managerProjects.beforeUpdate,
};
