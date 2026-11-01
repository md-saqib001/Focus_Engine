import { app } from 'electron'

app.name = 'focus-engine-temp'

import { getAllSessions } from './src/main/database/sessionRepository'
import { getSessionTelemetrySummary } from './src/main/database/telemetryAggregator'

function runSanityCheck() {
  app.whenReady().then(() => {
    const sessions = getAllSessions()
  console.log(`\n================= FOCUS SCORE SANITY CHECK =================`)
  console.log(
    `| ${'Session ID'.padEnd(10)} | ${'Mode'.padEnd(8)} | ${'Duration'.padEnd(8)} | ${'Score'.padEnd(5)} | ${'Buffer %'.padEnd(8)} | ${'Focus %'.padEnd(8)} | ${'Atten %'.padEnd(8)} | ${'CV Reweighted'.padEnd(15)} |`
  )
  console.log(''.padEnd(90, '-'))

  for (const s of sessions) {
    if (s.duration_actual_sec && s.duration_actual_sec > 0) {
      const summary = getSessionTelemetrySummary(s.session_id)
      if (summary && summary.focusScoreComponents) {
        const c = summary.focusScoreComponents
        console.log(
          `| ${s.session_id.substring(0, 10)} | ${s.session_mode.padEnd(8)} | ${s.duration_actual_sec.toString().padEnd(8)} | ${c.finalScore.toString().padEnd(5)} | ${c.averageBuffer.toString().padEnd(8)} | ${c.focusPercentage.toString().padEnd(8)} | ${(c.attentionPercentage !== null ? c.attentionPercentage.toString() : 'N/A').padEnd(8)} | ${c.reweighted ? 'Yes (No Cam)' : 'No (Cam On)'.padEnd(15)} |`
        )
      }
    }
  }
  console.log('============================================================\n')
  app.quit()
  })
}

runSanityCheck()
