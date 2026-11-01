import os
import sys
import json
import joblib
import numpy as np
from constants import FEATURES

def main():
    try:
        # 1. Read input JSON from stdin
        line = sys.stdin.readline()
        if not line:
            print(json.dumps({"success": False, "error": "No input received via stdin"}))
            return
            
        data = json.loads(line)
        
        # 2. Setup paths
        script_dir = os.path.dirname(os.path.abspath(__file__))
        focus_model_path = os.path.join(script_dir, "models", "focus_model.pkl")
        anomaly_model_path = os.path.join(script_dir, "models", "anomaly_model.pkl")
        
        if not os.path.exists(focus_model_path) or not os.path.exists(anomaly_model_path):
            print(json.dumps({"success": False, "error": "Trained model pkl files not found"}))
            return
            
        # 3. Load models
        focus_model = joblib.load(focus_model_path)
        anomaly_model = joblib.load(anomaly_model_path)
        
        # 4. Construct feature vector matching EXACT shared constant order
        vector = []
        for feature in FEATURES:
            val = data.get(feature)
            # Default to 0.0 if missing, though the caller should supply them
            if val is None:
                val = 0.0
            vector.append(float(val))
            
        X = np.array([vector])
        
        # 5. Run predictions
        predicted_score = focus_model.predict(X)[0]
        clamped_score = float(np.clip(predicted_score, 0.0, 100.0))
        
        # IsolationForest returns 1 for normal, -1 for anomaly
        predicted_anomaly = anomaly_model.predict(X)[0]
        is_anomaly = bool(predicted_anomaly == -1)
        
        # 6. Return response JSON
        print(json.dumps({
            "success": True,
            "focus_score": round(clamped_score, 2),
            "is_anomaly": is_anomaly
        }))
        
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == '__main__':
    main()
