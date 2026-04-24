module.exports = require('./crud')('incident_reports', {
  searchColumns: ['incident_number', 'title', 'site_name', 'incident_type', 'severity', 'description']
});
