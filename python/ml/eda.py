import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

def main():
    # 1. Setup paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    dataset_path = os.path.join(script_dir, "data", "dataset.csv")
    output_dir = os.path.join(script_dir, "eda_output")
    os.makedirs(output_dir, exist_ok=True)
    
    if not os.path.exists(dataset_path):
        print(f"Error: Dataset not found at {dataset_path}. Run dataset_builder.py first.")
        return
        
    # 2. Load dataset
    df = pd.read_csv(dataset_path)
    print("=================== DATASET INFO ===================")
    print(f"Total Rows: {len(df)}")
    print(f"Columns: {list(df.columns)}")
    print(df.info())
    print("\n=================== df.describe() ===================")
    print(df.describe().T)
    
    # 3. Null Handling Strategy
    # Drop rows missing target variable (focus_score)
    initial_len = len(df)
    df = df.dropna(subset=['focus_score'])
    dropped_target_count = initial_len - len(df)
    if dropped_target_count > 0:
        print(f"\n[Null Handling] Dropped {dropped_target_count} rows missing focus_score.")
        
    # Impute numeric feature nulls with median
    # We choose Median over Mean because the median is robust to outliers,
    # ensuring features like session_duration or avg_kpm are not skewed
    # by single anomalous sessions.
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    imputed_count = 0
    for col in numeric_cols:
        if col in ['focus_score', 'is_synthetic', 'timestamp']:
            continue
        null_mask = df[col].isnull()
        if null_mask.any():
            median_val = df[col].median()
            df.loc[null_mask, col] = median_val
            imputed_count += null_mask.sum()
            print(f"[Null Handling] Imputed {null_mask.sum()} nulls in '{col}' with median: {median_val}")
    print(f"[Null Handling] Total values imputed: {imputed_count}")
    
    # Check synthetic vs real splits
    real_df = df[df['is_synthetic'] == 0]
    syn_df = df[df['is_synthetic'] == 1]
    print(f"\n[Data Splits] Real sessions: {len(real_df)}, Synthetic sessions: {len(syn_df)}")
    
    # 4. Outlier Checks
    print("\n=================== OUTLIER AUDIT ===================")
    # Impossible session duration: <= 0 or > 12 hours (43200 seconds)
    duration_outliers = df[(df['session_duration'] <= 0) | (df['session_duration'] > 43200)]
    print(f"Sessions with anomalous duration (<=0s or >12hr): {len(duration_outliers)}")
    if not duration_outliers.empty:
        print(duration_outliers[['session_id', 'session_duration', 'is_synthetic']])
        
    # Impossible KPM: > 400
    kpm_outliers = df[df['avg_kpm'] > 400]
    print(f"Sessions with anomalous average KPM (>400 KPM): {len(kpm_outliers)}")
    if not kpm_outliers.empty:
        print(kpm_outliers[['session_id', 'avg_kpm', 'is_synthetic']])
        
    # 5. Visualizations
    sns.set_theme(style="whitegrid")
    
    # Plot 1: Focus Score Distribution (Overlap Histogram)
    plt.figure(figsize=(10, 6))
    if len(real_df) > 0:
        sns.histplot(data=real_df, x="focus_score", color="teal", label="Real Sessions", kde=True, alpha=0.6, bins=15)
    sns.histplot(data=syn_df, x="focus_score", color="coral", label="Synthetic Sessions", kde=True, alpha=0.6, bins=15)
    plt.title("Focus Score Distribution (Real vs Synthetic Overlap)", fontsize=14, pad=15)
    plt.xlabel("Focus Score", fontsize=12)
    plt.ylabel("Frequency Count", fontsize=12)
    plt.xlim(0, 100)
    plt.legend(frameon=True)
    plt.tight_layout()
    plot1_path = os.path.join(output_dir, "focus_score_dist.png")
    plt.savefig(plot1_path)
    plt.close()
    print(f"Saved: {plot1_path}")
    
    # Plot 2: Correlation Heatmap
    features = [
        "avg_buffer", "min_buffer", "max_buffer", "focus_time", 
        "attention_time", "avg_kpm", "mouse_activity", "pause_count", 
        "app_switches", "session_duration", "hour_of_day", "day_of_week", 
        "session_mode_is_standard", "focus_score"
    ]
    plt.figure(figsize=(12, 10))
    corr = df[features].corr()
    mask = np.triu(np.ones_like(corr, dtype=bool))
    sns.heatmap(corr, mask=mask, cmap="coolwarm", annot=True, fmt=".2f", square=True, linewidths=.5, cbar_kws={"shrink": .8})
    plt.title("Feature Correlation Matrix (Sliding Window)", fontsize=14, pad=15)
    plt.tight_layout()
    plot2_path = os.path.join(output_dir, "correlation_matrix.png")
    plt.savefig(plot2_path)
    plt.close()
    print(f"Saved: {plot2_path}")
    
    # Plot 3: Scatter hour_of_day vs focus_score (ONLY Real)
    plt.figure(figsize=(10, 6))
    if len(real_df) > 0:
        sns.scatterplot(data=real_df, x="hour_of_day", y="focus_score", color="teal", s=100, alpha=0.8, edgecolor="k")
        plt.title("Hour of Day vs Focus Score (Real Sessions Only)", fontsize=14, pad=15)
        plt.xlim(-0.5, 23.5)
        plt.xticks(range(24))
    else:
        plt.text(0.5, 0.5, "No Real Sessions Logged Yet\n(Awaiting user focus sessions)", 
                 horizontalalignment='center', verticalalignment='center', fontsize=14, color='gray')
        plt.title("Hour of Day vs Focus Score (Real Sessions - Empty State)", fontsize=14, pad=15)
    plt.xlabel("Hour of Day (Local Time)", fontsize=12)
    plt.ylabel("Focus Score", fontsize=12)
    plt.ylim(-5, 105)
    plt.tight_layout()
    plot3_path = os.path.join(output_dir, "hour_vs_score.png")
    plt.savefig(plot3_path)
    plt.close()
    print(f"Saved: {plot3_path}")
    
    print("\nEDA run completed successfully.")

if __name__ == '__main__':
    main()
