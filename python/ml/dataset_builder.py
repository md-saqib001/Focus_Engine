import os
import pandas as pd
from real_data_extractor import extract_real_data

def main():
    # 1. Setup paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(script_dir, "data")
    pool_path = os.path.join(data_dir, "synthetic_pool.csv")
    dataset_path = os.path.join(data_dir, "dataset.csv")
    
    # 2. Extract real data
    real_df = extract_real_data()
    if not real_df.empty:
        real_df['is_synthetic'] = 0
        real_count = len(real_df)
    else:
        real_count = 0
        real_df = pd.DataFrame(columns=[
            "session_id", "timestamp", "avg_buffer", "min_buffer", "max_buffer", 
            "focus_time", "attention_time", "avg_kpm", "mouse_activity", "pause_count", 
            "app_switches", "session_duration", "hour_of_day", "day_of_week", 
            "session_mode_is_standard", "focus_score", "is_synthetic"
        ])
        
    print(f"Loaded {real_count} real sessions.")
    
    # 3. Load synthetic pool
    if not os.path.exists(pool_path):
        print(f"Error: Synthetic pool does not exist at {pool_path}. Please run synthetic_generator.py first.")
        return
        
    synthetic_df = pd.read_csv(pool_path)
    print(f"Loaded {len(synthetic_df)} synthetic sessions from pool.")
    
    # 4. Merge and take sliding window of 40 most recent by timestamp
    combined_df = pd.concat([real_df, synthetic_df], ignore_index=True)
    
    # Sort DESCENDING (most recent first) and head(40)
    window_df = combined_df.sort_values('timestamp', ascending=False).head(40).copy()
    
    # 5. Calculate stats of the sliding window
    window_real_count = len(window_df[window_df['is_synthetic'] == 0])
    window_synthetic_count = len(window_df[window_df['is_synthetic'] == 1])
    real_percentage = (window_real_count / 40.0) * 100.0
    
    print("\n=======================================================")
    print(f"Training window: {window_real_count} real sessions, {window_synthetic_count} synthetic sessions ({real_percentage:.1f}% real)")
    print("=======================================================\n")
    
    # 6. Save window to dataset.csv
    window_df.to_csv(dataset_path, index=False)
    print(f"Saved sliding window dataset of {len(window_df)} rows to: {dataset_path}")
    
    # 7. Data Quality Check
    print("\n--- DATA QUALITY CHECK ---")
    quality_summary = []
    
    for col in window_df.columns:
        if col in ["session_id"]:
            continue
        null_count = window_df[col].isnull().sum()
        null_pct = (null_count / len(window_df)) * 100.0
        
        col_min = window_df[col].min()
        col_max = window_df[col].max()
        col_mean = window_df[col].mean()
        
        quality_summary.append({
            "Column": col,
            "Min": round(col_min, 2) if pd.notnull(col_min) else "N/A",
            "Max": round(col_max, 2) if pd.notnull(col_max) else "N/A",
            "Mean": round(col_mean, 2) if pd.notnull(col_mean) else "N/A",
            "Null Count": null_count,
            "Null Pct": f"{null_pct:.1f}%"
        })
        
        if null_pct > 20.0:
            print(f"[WARNING] Column '{col}' has high null rate: {null_pct:.1f}%!")
            
    q_df = pd.DataFrame(quality_summary)
    print(q_df.to_string(index=False))
    print("--------------------------\n")

if __name__ == '__main__':
    main()
