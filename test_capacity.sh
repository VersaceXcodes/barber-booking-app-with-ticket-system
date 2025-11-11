#!/bin/bash
echo "Testing capacity enforcement..."
echo -e "\n1. Checking current 12:40 slot status..."
curl -s "http://localhost:3000/api/availability/2025-11-26?service_id=service_001" | python3 -c "
import sys, json
data = json.load(sys.stdin)
slot = [s for s in data['slots'] if s['time'] == '12:40'][0]
print(f\"  {slot['booked_count']}/{slot['total_capacity']} booked, available={slot['is_available']}, status={slot['status']}\")
"

echo -e "\n2. Checking date-level availability..."
curl -s "http://localhost:3000/api/availability?start_date=2025-11-26&end_date=2025-11-26&service_id=service_001" | python3 -c "
import sys, json
data = json.load(sys.stdin)
date = data['dates'][0]
print(f\"  Date: {date['date']}, available_spots={date['available_spots']}, is_available={date['is_available']}\")
"
