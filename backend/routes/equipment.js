module.exports = require('./crud')('equipment_inspections', {
  searchColumns: ['equipment_name', 'equipment_type', 'equipment_id', 'site_name', 'condition']
});
