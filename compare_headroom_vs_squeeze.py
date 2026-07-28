"""
Headroom vs SQUEEZE Side-by-Side Benchmark & Test Runner
Compares compression ratio, token savings, and execution speed between Headroom and SQUEEZE.
"""

import json
import time
import subprocess
import sys

def run_squeeze_compress(text):
    """Run SQUEEZE compression via Node.js script."""
    cmd = [
        "node", "-e",
        f"const CR = require('./Squeeze_Internal_Pro/modules/router.js'); console.log(JSON.stringify(CR.compress(process.argv[1])));",
        text
    ]
    start = time.time()
    res = subprocess.run(cmd, capture_output=True, text=True, cwd="c:/AASHU DEVS/Squeeze")
    elapsed = (time.time() - start) * 1000
    if res.returncode == 0:
        data = json.loads(res.stdout.trim())
        data['time_ms'] = elapsed
        return data
    else:
        return {"error": res.stderr}

def run_headroom_compress(text):
    """Run Headroom compression via Python library."""
    try:
        from headroom import compress
        start = time.time()
        res = compress(text)
        elapsed = (time.time() - start) * 1000
        
        orig_len = len(text)
        comp_len = len(res) if isinstance(res, str) else len(str(res))
        orig_tokens = max(1, int(orig_len / 4))
        comp_tokens = max(1, int(comp_len / 4))
        savings = max(0, int(((orig_tokens - comp_tokens) / orig_tokens) * 100))
        
        return {
            "compressed": res,
            "originalTokens": orig_tokens,
            "compressedTokens": comp_tokens,
            "savingsPercent": savings,
            "time_ms": elapsed
        }
    except Exception as e:
        return {"error": str(e)}

def main():
    print("=" * 70)
    print("   HEADROOM vs SQUEEZE - Head-to-Head Benchmark Suite")
    print("=" * 70 + "\n")

    # Dataset 1: Large JSON Payload
    json_data = json.dumps({
        "status": "success",
        "code": 200,
        "logs": [
            {"id": i, "timestamp": "2026-07-28T09:25:00Z", "level": "INFO", "service": "auth-service", "message": "User authenticated successfully", "nullVal": None, "emptyMeta": {}}
            for i in range(40)
        ]
    })

    # Dataset 2: Source Code File
    code_data = """
    // User Management Service
    import React, { useState, useEffect } from 'react';
    import { fetchUserLogs, parseMetrics } from './utils/logger';

    /* Complex calculation function for metric parsing
       Saves metrics to local cache
    */
    export function UserDashboard({ userId, role }) {
        const [data, setData] = useState([]);
        const [loading, setLoading] = useState(true);

        useEffect(() => {
            // Fetch remote logs
            fetchUserLogs(userId).then(res => {
                setData(res);
                setLoading(false);
            });
        }, [userId]);

        return (
            <div className="dashboard-container">
                <h1>Dashboard for User {userId}</h1>
                <p>Status: {loading ? 'Loading...' : 'Ready'}</p>
            </div>
        );
    }
    """

    datasets = [
        ("1. Large JSON API Payload (40 Log Records)", json_data),
        ("2. React/TypeScript Source Code", code_data)
    ]

    for title, text in datasets:
        print(f"--- Benchmark: {title} ---")
        sq = run_squeeze_compress(text)
        hr = run_headroom_compress(text)

        print(f"{'Metric':<25} | {'SQUEEZE':<20} | {'HEADROOM':<20}")
        print("-" * 70)
        
        sq_orig = sq.get('originalTokens', 'N/A')
        sq_comp = sq.get('compressedTokens', 'N/A')
        sq_save = f"{sq.get('savingsPercent', 0)}%"
        sq_time = f"{sq.get('time_ms', 0):.1f} ms"

        hr_orig = hr.get('originalTokens', 'N/A')
        hr_comp = hr.get('compressedTokens', 'N/A')
        hr_save = f"{hr.get('savingsPercent', 0)}%" if 'error' not in hr else f"Error: {hr['error'][:15]}"
        hr_time = f"{hr.get('time_ms', 0):.1f} ms" if 'error' not in hr else "N/A"

        print(f"{'Original Tokens':<25} | {str(sq_orig):<20} | {str(hr_orig):<20}")
        print(f"{'Compressed Tokens':<25} | {str(sq_comp):<20} | {str(hr_comp):<20}")
        print(f"{'Token Savings (%)':<25} | {sq_save:<20} | {hr_save:<20}")
        print(f"{'Execution Time':<25} | {sq_time:<20} | {hr_time:<20}")
        print("\n")

if __name__ == "__main__":
    main()
