module.exports = require('./crud')('emergency_plans', {
  searchColumns: ['plan_title', 'plan_type', 'site_name', 'emergency_coordinator']
});
