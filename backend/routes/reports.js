module.exports = require('./crud')('daily_reports', {
  searchColumns: ['site_name', 'submitted_by', 'work_summary', 'safety_observations', 'toolbox_talk_topic']
});
