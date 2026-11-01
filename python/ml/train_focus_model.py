import os
import json
import joblib
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score, mean_absolute_error
from constants import FEATURES

def main():
    # 1. Setup paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    dataset_path = os.path.join(script_dir, "data", "dataset.csv")
    models_dir = os.path.join(script_dir, "models")
    os.makedirs(models_dir, exist_ok=True)
    
    if not os.path.exists(dataset_path):
        print(f"Error: Dataset not found at {dataset_path}. Run dataset_builder.py first.")
        return
        
    # 2. Load dataset
    df = pd.read_csv(dataset_path)
    
    # 3. Print window composition immediately FIRST
    total_rows = len(df)
    real_count = len(df[df['is_synthetic'] == 0])
    synthetic_count = len(df[df['is_synthetic'] == 1])
    real_pct = (real_count / total_rows) * 100.0 if total_rows > 0 else 0
    
    print("=================== TRAINING WINDOW COMPOSITION ===================")
    print(f"Total Window Size: {total_rows} sessions")
    print(f"Real Sessions    : {real_count} ({real_pct:.1f}%)")
    print(f"Synthetic Sessions: {synthetic_count} ({100.0 - real_pct:.1f}%)")
    print("===================================================================\n")
    
    # 4. Clean and drop missing targets
    df = df.dropna(subset=['focus_score'])
    
    # Impute missing feature values with Median
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        if col in ['focus_score', 'is_synthetic', 'timestamp']:
            continue
        if df[col].isnull().any():
            df[col] = df[col].fillna(df[col].median())
            
    # 5. Define features & target
    features = FEATURES
    target = "focus_score"
    
    X = df[features]
    y = df[target]
    
    # 6. Train/Test Split (80/20)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # 7. Model setup
    # Modest depth (max_depth=5) is chosen because the dataset has only 40 rows.
    # A shallow depth prevents the decision trees from splitting until they overfit to noise.
    model = RandomForestRegressor(n_estimators=100, max_depth=5, random_state=42)
    
    # 8. 5-Fold Cross-Validation (on training data)
    # Why CV: 5-fold cross-validation is vital here. With only 40 rows, a simple train/test split
    # creates severe variance (metrics swing wildly depending on which 8 rows land in the test set).
    # CV rotates validation sets across 5 distinct splits to average out this variance.
    cv_r2 = cross_val_score(model, X_train, y_train, cv=5, scoring='r2')
    cv_mae = cross_val_score(model, X_train, y_train, cv=5, scoring='neg_mean_absolute_error')
    
    # Train actual model
    model.fit(X_train, y_train)
    
    # 9. Evaluate on test set
    y_pred = model.predict(X_test)
    test_r2 = r2_score(y_test, y_pred)
    test_mae = mean_absolute_error(y_test, y_pred)
    
    # 10. Load old metadata to evaluate deployment threshold
    metadata_path = os.path.join(models_dir, "focus_model_metadata.json")
    old_cv_r2_mean = -999.0
    if os.path.exists(metadata_path):
        try:
            with open(metadata_path, 'r') as f:
                old_meta = json.load(f)
                old_cv_r2_mean = old_meta.get("cv_r2_mean", -999.0)
        except Exception as e:
            print(f"[Warning] Failed to load old metadata: {e}")

    new_cv_r2_mean = float(np.mean(cv_r2))
    new_cv_mae_mean = float(np.mean(-cv_mae))
    
    # Enforce threshold: deploy only if equal or improved
    should_deploy = new_cv_r2_mean >= old_cv_r2_mean

    # Output results honestly
    print("--- MODEL PERFORMANCE METRICS ---")
    print(f"Test Set R² Score  : {test_r2:.4f}")
    print(f"Test Set MAE Score : {test_mae:.4f}")
    print(f"5-Fold CV R² Mean  : {new_cv_r2_mean:.4f} (std: {np.std(cv_r2):.4f})")
    print(f"5-Fold CV MAE Mean : {new_cv_mae_mean:.4f} (std: {np.std(cv_mae):.4f})")
    print(f"Deployment Check   : New CV R² ({new_cv_r2_mean:.4f}) vs Old CV R² ({old_cv_r2_mean:.4f})")
    print(f"Should Deploy      : {should_deploy}")
    print("---------------------------------\n")
    
    print("[NOTE] This model's accuracy reflects a window that is currently mostly synthetic — ")
    print("expect these metrics to shift as real sessions accumulate and phase out the synthetic rows ")
    print("over the coming weeks.\n")
    
    # 11. Feature Importances
    importances = model.feature_importances_
    indices = np.argsort(importances)[::-1]
    
    print("--- FEATURE IMPORTANCES ---")
    for rank, idx in enumerate(indices):
        print(f"{rank + 1}. {features[idx]:<25}: {importances[idx]:.4f}")
    print("---------------------------\n")
    
    # 12. Save if improved
    import time
    status_dict = {
        "deployed": 1 if should_deploy else 0,
        "real_sessions": int(real_count),
        "synthetic_sessions": int(synthetic_count),
        "test_r2": float(test_r2),
        "test_mae": float(test_mae),
        "cv_r2_mean": new_cv_r2_mean,
        "cv_mae_mean": new_cv_mae_mean
    }

    if should_deploy:
        # Save model pkl
        model_path = os.path.join(models_dir, "focus_model.pkl")
        joblib.dump(model, model_path)
        print(f"Trained RandomForestRegressor saved to: {model_path}")

        # Save metadata
        meta_dict = {
            "timestamp": int(time.time() * 1000),
            "real_sessions": int(real_count),
            "synthetic_sessions": int(synthetic_count),
            "test_r2": float(test_r2),
            "test_mae": float(test_mae),
            "cv_r2_mean": new_cv_r2_mean,
            "cv_mae_mean": new_cv_mae_mean
        }
        with open(metadata_path, 'w') as f:
            json.dump(meta_dict, f, indent=2)
        print(f"Model metadata saved to: {metadata_path}")

        # Save feature importances
        importances_path = os.path.join(models_dir, "feature_importances.json")
        importances_dict = {features[idx]: float(importances[idx]) for idx in indices}
        with open(importances_path, 'w') as f:
            json.dump(importances_dict, f, indent=2)
        print(f"Feature importances saved to: {importances_path}")
    else:
        print("[Retrain] New model rejected. Keeping the existing higher-performing model.")

    # Write parseable print line for Node process manager
    import json as json_lib
    print(f"RETRAIN_STATUS: {json_lib.dumps(status_dict)}")

if __name__ == '__main__':
    main()
