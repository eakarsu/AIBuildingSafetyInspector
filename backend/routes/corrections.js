module.exports = require('./crud')('corrective_actions', {
  searchColumns: ['action_title', 'site_name', 'assigned_to', 'related_violation', 'related_incident']
});
