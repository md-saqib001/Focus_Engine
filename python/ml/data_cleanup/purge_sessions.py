import os
import sqlite3

def main():
    # 1. Locate the SQLite database path
    appdata = os.environ.get('APPDATA')
    if not appdata:
        appdata = os.path.expanduser('~\\AppData\\Roaming')
    
    db_path = os.path.join(appdata, 'focus-engine-temp', 'focus-engine.db')
    
    if not os.path.exists(db_path):
        print(f"Error: Database file does not exist at {db_path}")
        return

    # 2. Check to_purge.txt for session IDs
    script_dir = os.path.dirname(os.path.abspath(__file__))
    purge_file_path = os.path.join(script_dir, "to_purge.txt")
    
    if not os.path.exists(purge_file_path):
        with open(purge_file_path, "w") as f:
            f.write("# Paste session IDs to delete here (one per line, lines starting with '#' are ignored)\n")
        print(f"Created an empty list at: {purge_file_path}")
        print("Please paste the session IDs to delete (one per line) in that file and run this script again.")
        return

    # Read IDs from file
    session_ids = []
    with open(purge_file_path, "r") as f:
        for line in f:
            clean_line = line.strip()
            if clean_line and not clean_line.startswith('#'):
                session_ids.append(clean_line)

    if not session_ids:
        print(f"No session IDs found in: {purge_file_path}")
        print("Please paste the session IDs to delete (one per line) in that file.")
        return

    print(f"Loaded {len(session_ids)} session IDs to purge.")

    # 3. Connect to database and preview deletion counts
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    tables = [
        "sessions",
        "window_focus",
        "keyboard_metrics",
        "mouse_metrics",
        "cv_metrics",
        "cv_metrics_summary",
        "buffer_snapshots",
        "buffer_state_transitions",
        "distraction_events",
        "app_kill_events"
    ]
    
    print("\nCalculating records to be deleted...")
    deletion_preview = {}
    
    for table in tables:
        try:
            # Check if table exists first (some tables like cv_metrics might not be populated or might have minor differences)
            cursor.execute(f"SELECT count(*) FROM sqlite_master WHERE type='table' AND name='{table}'")
            if cursor.fetchone()[0] == 0:
                continue
                
            placeholders = ",".join(["?"] * len(session_ids))
            query = f"SELECT COUNT(*) FROM {table} WHERE session_id IN ({placeholders})"
            cursor.execute(query, session_ids)
            count = cursor.fetchone()[0]
            deletion_preview[table] = count
        except Exception as e:
            print(f"Warning: Could not count records in table '{table}': {e}")
            deletion_preview[table] = 0

    print("\n--- DELETION PREVIEW ---")
    for table, count in deletion_preview.items():
        print(f"- {table.ljust(25)}: {count} rows")
    print("------------------------")

    # 4. Require explicit confirmation
    confirm = input(f"\nAbout to permanently delete {len(session_ids)} sessions and all associated telemetry across 10 tables.\nThis is irreversible. Type 'yes' to confirm: ").strip().lower()
    
    if confirm != 'yes':
        print("\nDeletion cancelled. No changes were made to the database.")
        conn.close()
        return

    # 5. Perform deletions in a transaction
    print("\nExecuting deletions...")
    try:
        # Start transaction
        conn.execute("BEGIN TRANSACTION")
        
        for table in tables:
            if table not in deletion_preview or deletion_preview[table] == 0:
                continue
            
            placeholders = ",".join(["?"] * len(session_ids))
            delete_query = f"DELETE FROM {table} WHERE session_id IN ({placeholders})"
            cursor.execute(delete_query, session_ids)
            print(f"Deleted matching rows from '{table}'.")

        conn.commit()
        print("\nSuccess! Deletion completed and transaction committed.")
    except Exception as e:
        conn.rollback()
        print(f"\nError: Transaction failed. Database rolled back. Details: {e}")
        conn.close()
        return

    # 6. Print remaining sessions
    cursor.execute("SELECT COUNT(*) FROM sessions")
    total_remaining = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM sessions WHERE completed = 1")
    completed_remaining = cursor.fetchone()[0]
    
    print("\n--- DATABASE POST-CLEANUP STATUS ---")
    print(f"Total sessions remaining      : {total_remaining}")
    print(f"Completed sessions remaining  : {completed_remaining}")
    print("------------------------------------")
    
    conn.close()

if __name__ == '__main__':
    main()
