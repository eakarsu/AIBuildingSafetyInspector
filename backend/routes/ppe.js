module.exports = require('./crud')('ppe_inventory', {
  searchColumns: ['item_name', 'category', 'ppe_type', 'manufacturer', 'site_name']
});
