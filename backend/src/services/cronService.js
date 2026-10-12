const cron = require('node-cron');
const { runEscalationCheck } = require('./incidentService');

function startCronJobs() {
  // Every 10 minutes – check escalations and auto-close
  cron.schedule('*/10 * * * *', async () => {
    try {
      await runEscalationCheck();
    } catch (err) {
      console.error('[CRON] Escalation check failed:', err.message);
    }
  });

  console.log('⏰ Cron jobs started (escalation check every 10 min)');
}

module.exports = { startCronJobs };
