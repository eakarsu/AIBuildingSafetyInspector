module.exports = require('./crud')('violations', {
  searchColumns: ['violation_code', 'title', 'site_name', 'severity', 'description']
});
