"""
smoothing_test.py — Test script to simulate blinks and distractions.

Feeds an artificial sequence of raw scores to the ExponentialSmoother
and prints the raw vs smoothed output to demonstrate how it resists
brief micro-distractions (like blinks) but catches real shifts.
"""

import time
from score_smoother import ExponentialSmoother

def run_test():
    smoother = ExponentialSmoother(alpha=0.3)
    
    # Simulate a sequence of raw attention scores (e.g., sampled at 2fps)
    sequence = [
        # Normal working (fully attentive)
        1.0, 1.0, 1.0, 1.0,
        
        # A brief blink or tracker glitch (0.0 for one frame)
        0.0,
        
        # Back to normal
        1.0, 1.0, 1.0,
        
        # A quick glance away (0.5 for two frames)
        0.5, 0.5,
        
        # Back to normal
        1.0, 1.0, 1.0, 1.0,
        
        # Genuinely looking away at a phone (0.2 for a sustained period)
        0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2,
        
        # Recovering attention
        1.0, 1.0, 1.0, 1.0
    ]
    
    print("Testing ExponentialSmoother (alpha=0.3)\n")
    print(f"{'Tick':<6} | {'Raw':<6} | {'Smoothed':<8} | {'Behavior'}")
    print("-" * 50)
    
    for i, raw in enumerate(sequence):
        smoothed = smoother.update(raw)
        
        behavior = ""
        if i == 4:
            behavior = "<- Brief Blink / Glitch"
        elif i == 8:
            behavior = "<- Micro-distraction start"
        elif i == 13:
            behavior = "<- Sustained Distraction start"
        elif i == 20:
            behavior = "<- Attention Recovering"
            
        print(f"[{i:02d}]   | {raw:.1f}    | {smoothed:.3f}    | {behavior}")
        time.sleep(0.2) # Fast simulation

if __name__ == "__main__":
    run_test()
