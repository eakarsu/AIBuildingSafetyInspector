module.exports = require('./crud')('compliance_documents', {
  searchColumns: ['document_title', 'document_type', 'site_name', 'regulatory_body', 'document_number']
});
