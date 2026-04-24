module.exports = require('./crud')('safety_training', {
  searchColumns: ['training_title', 'training_type', 'instructor', 'site_name']
});
