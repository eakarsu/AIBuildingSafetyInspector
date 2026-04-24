module.exports = require('./crud')('safety_checklists', {
  searchColumns: ['checklist_name', 'site_name', 'category', 'assigned_to']
});
