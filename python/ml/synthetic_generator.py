import os
import uuid
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

def main():
    # 1. Setup paths and directories
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(script_dir, "data")
    os.makedirs(data_dir, exist_ok=True)
    
    pool_path = os.path.join(data_dir, "synthetic_pool.csv")
    
    # 2. Seed for reproducibility
    np.random.seed(42)
    
    # 3. Define total pool size
    pool_size = 200
    half_size = pool_size // 2
    
    # Set backdated timestamps spread across the past (90 days ago to 10 days ago)
    end_date = datetime.now() - timedelta(days=10)
    start_date = datetime.now() - timedelta(days=90)
    total_seconds = int((end_date - start_date).total_seconds())
    
    # Generate sorted random timestamps in epoch ms
    random_offsets = np.sort(np.random.randint(0, total_seconds, size=pool_size))
    timestamps = [int((start_date + timedelta(seconds=int(offset))).timestamp() * 1000) for offset in random_offsets]
    
    records = []
    
    # 4. Generate HIGH-FOCUS archetype pool (100 sessions)
    for i in range(half_size):
        session_id = str(uuid.uuid4())
        ts = timestamps[i]
        dt = datetime.fromtimestamp(ts / 1000.0)
        
        # Core dimensions
        duration = int(np.random.randint(1800, 3600)) # 30 - 60 minutes
        avg_buffer = np.clip(np.random.normal(85, 5), 75, 95)
        min_buffer = np.clip(np.random.normal(65, 8), 50, 78)
        max_buffer = np.clip(np.random.normal(98, 2), 90, 100)
        
        # Focus ratio and attention ratio
        focus_ratio = np.clip(np.random.normal(0.92, 0.03), 0.85, 0.98)
        focus_time = focus_ratio * duration
        
        attention_ratio = np.clip(np.random.normal(0.90, 0.04), 0.80, 0.98)
        attention_time = attention_ratio * duration
        
        # Activity
        avg_kpm = np.clip(np.random.normal(28, 6), 15, 45)
        # Mouse activity counts (clicks + movements)
        mouse_rate_per_min = np.clip(np.random.normal(120, 30), 60, 200)
        mouse_activity = int(mouse_rate_per_min * (duration / 60.0))
        
        # Pauses and switches
        pause_count = int(np.random.choice([0, 1, 2], p=[0.7, 0.2, 0.1]))
        switches_rate_per_hr = np.clip(np.random.normal(4, 2), 2, 10)
        app_switches = int(switches_rate_per_hr * (duration / 3600.0))
        
        # Mode
        session_mode_is_standard = int(np.random.choice([0, 1], p=[0.5, 0.5]))
        
        # Resulting focus score (high)
        focus_score = int(np.clip(np.random.normal(84, 5), 70, 95))
        
        records.append({
            "session_id": session_id,
            "timestamp": ts,
            "avg_buffer": round(avg_buffer, 2),
            "min_buffer": round(min_buffer, 2),
            "max_buffer": round(max_buffer, 2),
            "focus_time": round(focus_time, 2),
            "attention_time": round(attention_time, 2),
            "avg_kpm": round(avg_kpm, 2),
            "mouse_activity": mouse_activity,
            "pause_count": pause_count,
            "app_switches": app_switches,
            "session_duration": duration,
            "hour_of_day": dt.hour,
            "day_of_week": (dt.weekday() + 1) % 7, # 0 = Sunday
            "session_mode_is_standard": session_mode_is_standard,
            "is_synthetic": 1,
            "focus_score": focus_score
        })
        
    # 5. Generate LOW-FOCUS archetype pool (100 sessions)
    for i in range(half_size, pool_size):
        session_id = str(uuid.uuid4())
        ts = timestamps[i]
        dt = datetime.fromtimestamp(ts / 1000.0)
        
        # Core dimensions
        duration = int(np.random.randint(600, 2400)) # 10 - 40 minutes
        avg_buffer = np.clip(np.random.normal(32, 6), 20, 48)
        min_buffer = np.clip(np.random.normal(10, 4), 2, 22)
        max_buffer = np.clip(np.random.normal(65, 8), 45, 82)
        
        # Focus ratio and attention ratio
        focus_ratio = np.clip(np.random.normal(0.35, 0.08), 0.15, 0.55)
        focus_time = focus_ratio * duration
        
        attention_ratio = np.clip(np.random.normal(0.30, 0.08), 0.10, 0.50)
        attention_time = attention_ratio * duration
        
        # Activity
        avg_kpm = np.clip(np.random.normal(5, 3), 1, 12)
        # Mouse activity
        mouse_rate_per_min = np.clip(np.random.normal(25, 8), 10, 50)
        mouse_activity = int(mouse_rate_per_min * (duration / 60.0))
        
        # Pauses and switches (high)
        pause_count = int(np.random.randint(3, 8))
        switches_rate_per_hr = np.clip(np.random.normal(45, 12), 20, 80)
        app_switches = int(switches_rate_per_hr * (duration / 3600.0))
        
        # Mode
        session_mode_is_standard = int(np.random.choice([0, 1], p=[0.5, 0.5]))
        
        # Resulting focus score (low)
        focus_score = int(np.clip(np.random.normal(30, 6), 15, 45))
        
        records.append({
            "session_id": session_id,
            "timestamp": ts,
            "avg_buffer": round(avg_buffer, 2),
            "min_buffer": round(min_buffer, 2),
            "max_buffer": round(max_buffer, 2),
            "focus_time": round(focus_time, 2),
            "attention_time": round(attention_time, 2),
            "avg_kpm": round(avg_kpm, 2),
            "mouse_activity": mouse_activity,
            "pause_count": pause_count,
            "app_switches": app_switches,
            "session_duration": duration,
            "hour_of_day": dt.hour,
            "day_of_week": (dt.weekday() + 1) % 7, # 0 = Sunday
            "session_mode_is_standard": session_mode_is_standard,
            "is_synthetic": 1,
            "focus_score": focus_score
        })

    # Save to DataFrame and CSV
    df = pd.DataFrame(records)
    df.to_csv(pool_path, index=False)
    print(f"Generated synthetic pool with {len(df)} rows.")
    print(f"Saved pool successfully to: {pool_path}")

if __name__ == '__main__':
    main()
