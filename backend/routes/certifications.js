module.exports = require('./crud')('worker_certifications', {
  searchColumns: ['worker_name', 'worker_id', 'certification_type', 'issuing_authority', 'site_name']
});
