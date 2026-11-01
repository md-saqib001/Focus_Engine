import os
import sqlite3
import csv
from datetime import datetime

def format_epoch_ms(ms):
    if not ms:
        return 'N/A'
    dt = datetime.fromtimestamp(ms / 1000.0)
    return dt.strftime('%Y-%m-%d %H:%M:%S')

def main():
    # 1. Locate the SQLite database path
    appdata = os.environ.get('APPDATA')
    if not appdata:
        appdata = os.path.expanduser('~\\AppData\\Roaming')
    
    db_path = os.path.join(appdata, 'focus-engine-temp', 'focus-engine.db')
    print(f"Connecting to database: {db_path}")
    
    if not os.path.exists(db_path):
        print(f"Error: Database file does not exist at {db_path}")
        return

    # 2. Execute query
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    query = """
        SELECT 
          s.session_id,
          s.start_time,
          s.session_mode,
          s.session_type,
          s.duration_actual_sec,
          s.completed,
          s.end_reason,
          s.focus_score,
          (SELECT COUNT(*) FROM app_kill_events e WHERE e.session_id = s.session_id) as apps_killed_count,
          (SELECT COUNT(*) FROM distraction_events d WHERE d.session_id = s.session_id) as distraction_event_count
        FROM sessions s
        ORDER BY s.start_time ASC
    """
    
    try:
        cursor.execute(query)
        rows = cursor.fetchall()
    except Exception as e:
        print(f"Database query error: {e}")
        conn.close()
        return

    conn.close()

    if not rows:
        print("No sessions found in the database.")
        return

    # 3. Format and print table to console
    headers = [
        "Session ID", "Date + Time", "Mode", "Type", 
        "Duration (s)", "Completed", "End Reason", 
        "Focus Score", "Apps Killed", "Distractions"
    ]
    
    # Process rows for printing and CSV saving
    processed_rows = []
    for r in rows:
        session_id = r[0]
        date_time = format_epoch_ms(r[1])
        mode = r[2]
        session_type = r[3] if r[3] else 'N/A'
        duration = str(r[4]) if r[4] is not None else 'N/A'
        completed = 'Yes' if r[5] == 1 else 'No'
        end_reason = r[6] if r[6] else 'N/A'
        focus_score = f"{int(r[7])}%" if r[7] is not None else 'N/A'
        apps_killed = str(r[8])
        distractions = str(r[9])
        
        processed_rows.append([
            session_id, date_time, mode, session_type, 
            duration, completed, end_reason, 
            focus_score, apps_killed, distractions
        ])

    # Calculate column widths for aligned printing
    col_widths = [len(h) for h in headers]
    for row in processed_rows:
        for idx, val in enumerate(row):
            col_widths[idx] = max(col_widths[idx], len(val))

    # Print table header
    row_format = " | ".join([f"{{:<{w}}}" for w in col_widths])
    print("\n" + "=" * (sum(col_widths) + 3 * len(col_widths) - 1))
    print(row_format.format(*headers))
    print("=" * (sum(col_widths) + 3 * len(col_widths) - 1))
    
    # Print table rows
    for row in processed_rows:
        print(row_format.format(*row))
    print("=" * (sum(col_widths) + 3 * len(col_widths) - 1) + "\n")

    # 4. Save to CSV file
    output_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(output_dir, "session_review.csv")
    
    print(f"Saving review list to: {csv_path}")
    try:
        with open(csv_path, mode='w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            writer.writerows(processed_rows)
        print("CSV file saved successfully.")
    except Exception as e:
        print(f"Error saving CSV file: {e}")

if __name__ == '__main__':
    main()
