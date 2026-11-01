import { ipcMain } from 'electron'
import { heatmapRepository } from '../analytics/heatmapRepository'
import { streakCalculator } from '../analytics/streakCalculator'
import { productivityAnalytics } from '../analytics/productivityAnalytics'
import { recommendationEngine } from '../analytics/recommendationEngine'

export function registerAnalyticsHandlers(): void {
  ipcMain.handle('analytics:getHeatmap', async () => {
    try {
      const data = heatmapRepository.getFocusHeatmapData()
      return { success: true, data }
    } catch (error) {
      console.error('[IPC analytics:getHeatmap]', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('analytics:getStreaks', async () => {
    try {
      const data = streakCalculator.calculateStreaks()
      return { success: true, data }
    } catch (error) {
      console.error('[IPC analytics:getStreaks]', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('analytics:getProductivitySummary', async () => {
    try {
      const data = productivityAnalytics.getProductivitySummary()
      return { success: true, data }
    } catch (error) {
      console.error('[IPC analytics:getProductivitySummary]', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('analytics:getRecommendations', async () => {
    try {
      const data = recommendationEngine.generateRecommendations()
      return { success: true, data }
    } catch (error) {
      console.error('[IPC analytics:getRecommendations]', error)
      return { success: false, error: String(error) }
    }
  })
}
