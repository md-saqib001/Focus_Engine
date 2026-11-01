import { getDatabase } from './db'

/**
 * Default v2 10-point calibration values.
 * Based on a typical laptop setup: camera above screen, user sitting ~60cm away.
 * User should run calibration to replace these with their personal values.
 */
export const DEFAULT_CALIBRATION_V2 = {
  version: 2,
  screen: {
    center:       { yaw:  -8.67, pitch: -18.53, gaze_ratio: 0.51 },
    top_left:     { yaw:   9.14, pitch: -17.03, gaze_ratio: 0.55 },
    top_right:    { yaw:  -24.4,  pitch: -19.44, gaze_ratio: 0.48 },
    bottom_left:  { yaw:  10.06, pitch: -16.44, gaze_ratio: 0.54 },
    bottom_right: { yaw: -21.84, pitch: -18.84, gaze_ratio: 0.46 }
  },
  keyboard: {
    center:       { yaw:  -0.07, pitch: -16.36, gaze_ratio: 0.50 },
    top_left:     { yaw:  10.76, pitch: -12.21, gaze_ratio: 0.50 },
    top_right:    { yaw: -22.95, pitch: -16.41, gaze_ratio: 0.50 },
    bottom_left:  { yaw:  16.54, pitch: -16.87, gaze_ratio: 0.50 },
    bottom_right: { yaw: -19.77, pitch: -19.54, gaze_ratio: 0.50 }
  }
}

export const settingsRepository = {
  getSetting(key: string, defaultValue: string = ''): string {
    const db = getDatabase()
    const stmt = db.prepare('SELECT setting_value FROM app_settings WHERE setting_key = ?')
    const row = stmt.get(key) as { setting_value: string } | undefined
    return row ? row.setting_value : defaultValue
  },

  setSetting(key: string, value: string): void {
    const db = getDatabase()
    const stmt = db.prepare(`
      INSERT INTO app_settings (setting_key, setting_value)
      VALUES (?, ?)
      ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value
    `)
    stmt.run(key, value)
  },

  getCVEnabled(): boolean {
    const val = this.getSetting('cv_enabled', 'true')
    return val === 'true'
  },

  setCVEnabled(enabled: boolean): void {
    this.setSetting('cv_enabled', enabled ? 'true' : 'false')
  },

  getCVPermission(): 'granted' | 'denied' | 'pending' {
    const val = this.getSetting('cv_permission', 'pending')
    if (val === 'granted' || val === 'denied' || val === 'pending') {
      return val
    }
    return 'pending'
  },

  setCVPermission(permission: 'granted' | 'denied' | 'pending'): void {
    this.setSetting('cv_permission', permission)
  },

  /**
   * Returns the current user calibration, or the built-in defaults if none has been set.
   */
  getCalibration(): object {
    const raw = this.getSetting('cv_calibration', '')
    if (raw) {
      try {
        return JSON.parse(raw)
      } catch {
        // Corrupt JSON — fall through to defaults
      }
    }
    return DEFAULT_CALIBRATION_V2
  },

  setCalibration(calibration: object): void {
    this.setSetting('cv_calibration', JSON.stringify(calibration))
  },

  /**
   * Returns the built-in default calibration (v2 10-point).
   */
  getDefaultCalibration(): object {
    return DEFAULT_CALIBRATION_V2
  },

  /**
   * Resets the user calibration back to the built-in defaults.
   */
  resetCalibrationToDefault(): void {
    this.setSetting('cv_calibration', JSON.stringify(DEFAULT_CALIBRATION_V2))
    console.log('[SettingsRepository] Calibration reset to factory defaults.')
  },

  /**
   * Seeds default calibration on first launch (if no calibration stored yet).
   * Call this once during app startup.
   */
  seedDefaultsIfNeeded(): void {
    const existing = this.getSetting('cv_calibration', '')
    if (!existing) {
      this.resetCalibrationToDefault()
      console.log('[SettingsRepository] Seeded default v2 calibration on first launch.')
    }
  }
}
