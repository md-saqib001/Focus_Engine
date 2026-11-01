import { FocusBuffer } from './focusBuffer'

function runSimulation() {
  console.log('==================================================')
  console.log('FOCUS BUFFER MATHEMATICAL SIMULATION TEST')
  console.log('==================================================\n')

  // Scenario A: Sustained 1.0 multipliers for 60s
  console.log('--- Scenario A: Sustained Focus (60 seconds) ---')
  const bufferA = new FocusBuffer()
  console.log('Start Value:', bufferA.getCurrentValue(), 'State:', bufferA.getState())

  let staysAt100 = true
  for (let second = 1; second <= 60; second++) {
    const val = bufferA.update({ cv: 1.0, keyboard: 1.0, mouse: 1.0, window: 1.0 }, 0)
    if (val !== 100) {
      staysAt100 = false
    }
  }
  console.log(`End Value after 60s: ${bufferA.getCurrentValue()} | State: ${bufferA.getState()}`)
  console.log(`Verification: Stays locked at 100? ${staysAt100 ? 'SUCCESS' : 'FAILED'}\n`)

  // Scenario B: 20s focus -> 20s degraded -> 20s recovery
  console.log('--- Scenario B: Focus -> Degradation -> Recovery (60 seconds) ---')
  const bufferB = new FocusBuffer()
  console.log(`Time: 0s | Value: ${bufferB.getCurrentValue().toFixed(2)} | State: ${bufferB.getState()}`)

  for (let second = 1; second <= 60; second++) {
    let cv = 1.0
    let keyboard = 1.0
    let mouse = 1.0
    let windowMult = 1.0
    let penalty = 0

    let phase = ''
    if (second <= 20) {
      phase = 'Normal Focus'
      // Normal focus multipliers (1.0)
    } else if (second <= 40) {
      phase = 'Degraded Focus'
      cv = 0.3
      penalty = 5
    } else {
      phase = 'Recovery Phase'
      // Normal focus (1.0), triggers Option B additive recovery (+0.5/sec)
    }

    const val = bufferB.update({ cv, keyboard, mouse, window: windowMult }, penalty)
    console.log(
      `Time: ${second.toString().padStart(2, ' ')}s | ` +
      `Phase: ${phase.padEnd(15, ' ')} | ` +
      `Value: ${val.toFixed(2).padStart(6, ' ')} | ` +
      `State: ${bufferB.getState().padEnd(9, ' ')} | ` +
      `CV: ${cv.toFixed(1)} | Pen: ${penalty}`
    );
  }
  console.log('\n==================================================')
  console.log('SIMULATION RUN COMPLETE')
  console.log('==================================================')
}

runSimulation()
