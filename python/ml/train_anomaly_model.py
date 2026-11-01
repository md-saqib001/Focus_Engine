import os
import joblib
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from constants import FEATURES

def main():
    # 1. Setup paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    dataset_path = os.path.join(script_dir, "data", "dataset.csv")
    pool_path = os.path.join(script_dir, "data", "synthetic_pool.csv")
    models_dir = os.path.join(script_dir, "models")
    os.makedirs(models_dir, exist_ok=True)
    
    if not os.path.exists(dataset_path):
        print(f"Error: Dataset not found at {dataset_path}. Run dataset_builder.py first.")
        return
        
    # 2. Load window dataset
    df_window = pd.read_csv(dataset_path)
    
    # Define features (IsolationForest is unsupervised, so we exclude target focus_score)
    features = FEATURES
    
    # 3. Clean and prep window dataset
    df_window = df_window.dropna(subset=features)
    for col in features:
        if df_window[col].isnull().any():
            df_window[col] = df_window[col].fillna(df_window[col].median())
            
    # 4. Filter for high-focus sessions (focus_score >= 70) WITHIN the window
    df_high_focus = df_window[df_window['focus_score'] >= 70]
    
    print("=================== ANOMALY MODEL TRAINING DATA ===================")
    print(f"High-focus sessions in current window (score >= 70): {len(df_high_focus)}")
    
    # 5. Handle empty/sparse window fallback
    if len(df_high_focus) < 5:
        print("[WARNING] Current sliding window contains insufficient high-focus sessions for training.")
        print("Falling back to full synthetic pool (synthetic_pool.csv) for calibration baseline...")
        
        if not os.path.exists(pool_path):
            print(f"Error: Synthetic pool not found at {pool_path}. Run synthetic_generator.py first.")
            return
            
        df_pool = pd.read_csv(pool_path)
        df_pool = df_pool.dropna(subset=features)
        df_pool_high_focus = df_pool[df_pool['focus_score'] >= 70]
        
        print(f"Extracted {len(df_pool_high_focus)} high-focus sessions from pool for training.")
        X_train = df_pool_high_focus[features]
        trained_on_fallback = True
    else:
        X_train = df_high_focus[features]
        trained_on_fallback = False
        
    print("===================================================================\n")
    
    # 6. Train IsolationForest
    # Contamination = 0.1 means we expect roughly 10% of high-focus sessions to be flagged as anomalies (noise).
    model = IsolationForest(contamination=0.1, random_state=42)
    model.fit(X_train)
    
    # 7. Evaluate predict() on the full window dataset
    # In IsolationForest, predict() outputs:
    #   1  = normal (inlier)
    #  -1  = anomaly (outlier)
    X_window = df_window[features]
    predictions = model.predict(X_window)
    
    df_window['anomaly_prediction'] = predictions
    anomaly_sessions = df_window[df_window['anomaly_prediction'] == -1]
    normal_sessions = df_window[df_window['anomaly_prediction'] == 1]
    
    # Low-focus sessions: focus_score < 50
    low_focus_sessions = df_window[df_window['focus_score'] < 50]
    low_focus_anomalies = low_focus_sessions[low_focus_sessions['anomaly_prediction'] == -1]
    
    anomaly_rate = (len(anomaly_sessions) / len(df_window)) * 100.0 if len(df_window) > 0 else 0
    low_focus_anomaly_rate = (len(low_focus_anomalies) / len(low_focus_sessions)) * 100.0 if len(low_focus_sessions) > 0 else 0
    
    print("--- ANOMALY EVALUATION RESULTS ---")
    print(f"Sliding Window Size        : {len(df_window)}")
    print(f"Sessions Flagged Anomalous : {len(anomaly_sessions)} ({anomaly_rate:.1f}%)")
    print(f"Sessions Flagged Normal    : {len(normal_sessions)} ({100.0 - anomaly_rate:.1f}%)")
    print(f"Low-Focus Sessions (<50)   : {len(low_focus_sessions)}")
    print(f"Low-Focus Flagged Anomalous: {len(low_focus_anomalies)} ({low_focus_anomaly_rate:.1f}%)")
    print("----------------------------------\n")
    
    if low_focus_anomaly_rate > 50.0:
        print("[SUCCESS] Low-focus sessions are correctly flagged as anomalies at a high rate.")
    else:
        print("[WARNING] Low-focus sessions are not being flagged as anomalies at a high rate. Check calibration.")
        
    # 8. Save Anomaly model
    model_path = os.path.join(models_dir, "anomaly_model.pkl")
    joblib.dump(model, model_path)
    print(f"\nTrained IsolationForest saved to: {model_path}")

if __name__ == '__main__':
    main()
