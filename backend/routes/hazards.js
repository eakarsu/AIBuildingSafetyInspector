module.exports = require('./crud')('hazard_assessments', {
  searchColumns: ['hazard_title', 'hazard_type', 'site_name', 'risk_level', 'assessed_by']
});
