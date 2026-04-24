module.exports = require('./crud')('site_inspections', {
  searchColumns: ['site_name', 'inspector_name', 'inspection_type', 'overall_rating', 'findings']
});
