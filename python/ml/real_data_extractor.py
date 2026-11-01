import os
import sqlite3
import pandas as pd
import numpy as np

def get_db_path():
    appdata = os.environ.get('APPDATA')
    if not appdata:
        appdata = os.path.expanduser('~\\AppData\\Roaming')
    return os.path.join(appdata, 'focus-engine-temp', 'focus-engine.db')

def extract_real_data():
    db_path = get_db_path()
    if not os.path.exists(db_path):
        print(f"Error: Database file not found at {db_path}")
        return pd.DataFrame()
        
    # Read-only URI mode
    db_uri = f"file:{db_path}?mode=ro"
    try:
        conn = sqlite3.connect(db_uri, uri=True)
    except sqlite3.NotSupportedError:
        # Fallback if Python's sqlite3 doesn't support URI mode
        conn = sqlite3.connect(db_path)
        
    cursor = conn.cursor()

    query = """
        SELECT 
          s.session_id,
          s.start_time as timestamp,
          COALESCE((SELECT AVG(value) FROM buffer_snapshots WHERE session_id = s.session_id), s.focus_score, 100.0) as avg_buffer,
          COALESCE((SELECT MIN(value) FROM buffer_snapshots WHERE session_id = s.session_id), s.focus_score, 100.0) as min_buffer,
          COALESCE((SELECT MAX(value) FROM buffer_snapshots WHERE session_id = s.session_id), 100.0) as max_buffer,
          COALESCE((SELECT SUM(duration) / 1000.0 FROM buffer_state_transitions WHERE session_id = s.session_id AND state = 'focused'), s.duration_actual_sec, 0.0) as focus_time,
          COALESCE((SELECT face_present_pct / 100.0 * s.duration_actual_sec FROM cv_metrics_summary WHERE session_id = s.session_id), s.duration_actual_sec, 0.0) as attention_time,
          COALESCE((SELECT AVG(kpm) FROM keyboard_metrics WHERE session_id = s.session_id), 0.0) as avg_kpm,
          COALESCE((SELECT SUM(click_count + movement_count) FROM mouse_metrics WHERE session_id = s.session_id), 0.0) as mouse_activity,
          s.pause_count,
          COALESCE((SELECT COUNT(*) FROM window_focus WHERE session_id = s.session_id), 0) as app_switches,
          s.duration_actual_sec as session_duration,
          CAST(strftime('%H', s.start_time / 1000, 'unixepoch', 'localtime') AS INTEGER) as hour_of_day,
          CAST(strftime('%w', s.start_time / 1000, 'unixepoch', 'localtime') AS INTEGER) as day_of_week,
          CASE WHEN s.session_mode = 'standard' THEN 1 ELSE 0 END as session_mode_is_standard,
          s.focus_score
        FROM sessions s
        WHERE s.completed = 1 AND s.focus_score IS NOT NULL
        ORDER BY s.start_time ASC
    """
    
    try:
        df = pd.read_sql_query(query, conn)
    except Exception as e:
        print(f"Error reading database: {e}")
        df = pd.DataFrame()
    finally:
        conn.close()
        
    return df

def main():
    print("Extracting real focus sessions...")
    df = extract_real_data()
    
    total_real = len(df)
    print(f"Extracted {total_real} genuine completed sessions.")
    
    # ML Features list (13 total)
    features = [
        "avg_buffer", "min_buffer", "max_buffer", "focus_time", 
        "attention_time", "avg_kpm", "mouse_activity", "pause_count", 
        "app_switches", "session_duration", "hour_of_day", "day_of_week", 
        "session_mode_is_standard"
    ]
    
    if total_real == 0:
        print("\n[WARNING] No real focus sessions found in the database (Day 40.5 cleanup successfully cleared all test runs).")
        print("ML Calibration will utilize fallback baseline distributions.")
        return
        
    if total_real < 5:
        print(f"\n[WARNING] Calibration dataset is too sparse ({total_real} real sessions).")
        print("Calibration will use wider default boundaries to handle extreme variance.")
    
    print("\n--- REAL DATA SUMMARY STATISTICS ---")
    summary = df[features + ["focus_score"]].describe().T[['mean', 'std', 'min', 'max']]
    print(summary.to_string())
    print("------------------------------------\n")

if __name__ == '__main__':
    main()
