/**
 * Automated Verification Script for SQUEEZE 10 Heavy-Duty Test Prompts
 */

const ContentRouter = require('./Squeeze_Internal_Pro/modules/router.js');
const { globalCCR } = require('./Squeeze_Internal_Pro/modules/ccr-store.js');

const prompts = [
  {
    id: 1,
    name: "Heavy JSON API Payload",
    type: "JSON Data",
    content: JSON.stringify([
      { "user_id": 101, "user_name": "Alexander Hamilton", "role": "administrator", "account_status": "active", "last_login": "2026-07-28T10:00:00Z", "metadata": null, "session_flags": [], "audit_trail": null },
      { "user_id": 102, "user_name": "Elizabeth Schuyler", "role": "engineer", "account_status": "active", "last_login": "2026-07-28T10:05:00Z", "metadata": null, "session_flags": [], "audit_trail": null },
      { "user_id": 103, "user_name": "Aaron Burr", "role": "analyst", "account_status": "suspended", "last_login": "2026-07-27T18:30:00Z", "metadata": null, "session_flags": [], "audit_trail": null },
      { "user_id": 104, "user_name": "Angelica Schuyler", "role": "manager", "account_status": "active", "last_login": "2026-07-28T09:12:00Z", "metadata": null, "session_flags": [], "audit_trail": null }
    ], null, 2)
  },
  {
    id: 2,
    name: "React / TypeScript Dashboard Component",
    type: "TypeScript Code",
    content: `/**
 * UserDashboardComponent.tsx
 * Author: Development Team
 * Description: Renders the user overview matrix with filtering and sorting hooks.
 */

import React, { useState, useEffect } from 'react';
// import { fetchUserData } from '../api/userService';

interface UserDashboardProps {
  initialFilter?: string;
  onUserSelect: (id: number) => void;
}

export function UserDashboard({ initialFilter = 'all', onUserSelect }: UserDashboardProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // console.log("Fetching user dashboard records...");
    setLoading(false);
  }, []);

  return (
    <div className="dashboard-wrapper">
      <h2>User Directory Overview</h2>
      {loading ? <p>Loading users...</p> : <div>Data Loaded</div>}
    </div>
  );
}`
  },
  {
    id: 3,
    name: "Server Error Log & Stack Trace",
    type: "Log File",
    content: `2026-07-28 10:14:02.102 [ERROR] [http-worker-9] c.a.s.service.UserService : Database connection timeout on node-01
2026-07-28 10:14:02.102 [ERROR] [http-worker-9] c.a.s.service.UserService : Failed query attempt #1
2026-07-28 10:14:02.103 [ERROR] [http-worker-9] c.a.s.service.UserService : Retrying connection attempt #2...
2026-07-28 10:14:02.104 [ERROR] [http-worker-9] c.a.s.service.UserService : Retrying connection attempt #3...
2026-07-28 10:14:02.105 [ERROR] [http-worker-9] c.a.s.service.UserService : Connection pool exhausted.
java.sql.SQLException: Cannot get connection from pool after 5000ms
	at com.zaxxer.hikari.pool.HikariPool.getConnection(HikariPool.java:213)
	at com.zaxxer.hikari.pool.HikariPool.getConnection(HikariPool.java:162)
	at com.aashu.squeeze.service.UserService.getUserDetails(UserService.java:84)`
  },
  {
    id: 4,
    name: "Python Data Analysis Script",
    type: "Python Code",
    content: `"""
Data Processing Pipeline
Strips null values, normalizes columns, and computes summary statistics.
"""

import pandas as pd
import numpy as np

def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    # Drop completely empty columns
    df = df.dropna(how='all', axis=1)
    
    # Fill missing numeric values with median
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    df[numeric_cols] = df[numeric_cols].fillna(df[numeric_cols].median())
    
    return df

if __name__ == '__main__':
    # print("Pipeline started...")
    pass`
  },
  {
    id: 5,
    name: "Repetitive SQL Database Schema Dump",
    type: "SQL Schema",
    content: `CREATE TABLE orders (
    order_id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10,2) NOT NULL,
    order_status VARCHAR(50) DEFAULT 'pending',
    shipping_address TEXT,
    billing_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    item_id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);`
  },
  {
    id: 6,
    name: "HTML & CSS Component Code",
    type: "HTML/CSS",
    content: `<div class="product-card" id="card-101">
  <div class="card-image-wrapper">
    <img src="/assets/products/laptop.jpg" alt="Pro Laptop 16 inch" class="card-img" />
  </div>
  <div class="card-body">
    <h3 class="card-title">Pro Laptop 16" (M3 Max, 36GB RAM)</h3>
    <p class="card-description">Enterprise performance laptop with liquid retina display and all-day battery life.</p>
    <div class="card-price-row">
      <span class="price">$2,499.00</span>
      <button class="btn btn-primary" onclick="addToCart(101)">Add to Cart</button>
    </div>
  </div>
</div>`
  },
  {
    id: 7,
    name: "Verbose Prompt with Conversational Fluff",
    type: "Prose Prompt",
    content: `Hey Claude! Good morning! Hope you are having a fantastic day today! 

I was wondering if you could possibly help me out with a quick coding question whenever you have a moment? No rush at all! 

Basically, what I am trying to do is write a simple JavaScript function that takes an array of numbers as an input parameter, filters out all the odd numbers, and then returns a new array containing only the even numbers multiplied by 2. 

Thanks so much in advance for your assistance! I really appreciate your help!`
  },
  {
    id: 8,
    name: "Multi-Level Nesting YAML Config",
    type: "YAML Config",
    content: `version: '3.8'

services:
  web-app:
    image: squeeze/web-app:v1.2.0
    restart: always
    ports:
      - "8080:8080"
    environment:
      NODE_ENV: production
      PORT: 8080
      LOG_LEVEL: info
      DB_HOST: postgres-node.internal
      DB_PORT: 5432
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3`
  },
  {
    id: 9,
    name: "Network HTTP Request Header Dump",
    type: "HTTP Headers",
    content: `POST /v1/chat/completions HTTP/1.1
Host: api.openai.com
User-Agent: SqueezeClient/1.0.0 (Windows NT 10.0; Win64; x64)
Accept: application/json
Content-Type: application/json
Authorization: Bearer sk-proj-000000000000000000000000000
X-Request-Id: req_88921823901238910
Cache-Control: no-cache
Accept-Encoding: gzip, deflate, br

{
  "model": "gpt-4o",
  "temperature": 0.7,
  "max_tokens": 1000
}`
  },
  {
    id: 10,
    name: "Mixed Technical Documentation Spec",
    type: "Markdown Docs",
    content: `# API Authentication Specification v2.0

All HTTP requests to the Squeeze API endpoints must include a valid Bearer token in the Authorization header.

## Request Syntax
\`\`\`bash
curl -X POST https://api.squeeze.ai/v1/compress \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"content": "sample text"}'
\`\`\`

## Response Schema
\`\`\`json
{
  "status": "success",
  "originalTokens": 100,
  "compressedTokens": 35,
  "savingsPercent": 65
}
\`\`\``
  }
];

console.log("\n==========================================================================================");
console.log("             SQUEEZE AI - AUTOMATED VERIFICATION OF 10 HEAVY-DUTY PROMPTS                ");
console.log("==========================================================================================\n");

let passedCount = 0;
let totalOriginalTokens = 0;
let totalCompressedTokens = 0;

prompts.forEach(item => {
  const result = ContentRouter.compress(item.content);
  totalOriginalTokens += result.originalTokens;
  totalCompressedTokens += result.compressedTokens;

  const passed = result.compressedTokens < result.originalTokens && result.compressed.length > 0;
  if (passed) passedCount++;

  console.log(`Prompt #${item.id} [${item.name}] (${item.type})`);
  console.log(`  Engine Used:       ${result.contentType.toUpperCase()}`);
  console.log(`  Original Tokens:   ${result.originalTokens}`);
  console.log(`  Compressed Tokens: ${result.compressedTokens}`);
  console.log(`  Savings Percent:   ${result.savingsPercent}%`);
  console.log(`  Status:            ${passed ? '✅ PASS' : '⚠️ NO REDUCTION'}`);
  console.log("------------------------------------------------------------------------------------------");
});

const overallSavings = Math.round(((totalOriginalTokens - totalCompressedTokens) / totalOriginalTokens) * 100);

console.log("\n==========================================================================================");
console.log(`SUMMARY: ${passedCount}/${prompts.length} PROMPTS COMPRESSED SUCCESSFULLY`);
console.log(`TOTAL ORIGINAL TOKENS:   ${totalOriginalTokens}`);
console.log(`TOTAL COMPRESSED TOKENS: ${totalCompressedTokens}`);
console.log(`OVERALL TOKEN SAVINGS:   ${overallSavings}% SAVED`);
console.log("==========================================================================================\n");
