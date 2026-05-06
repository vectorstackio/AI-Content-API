#!/bin/sh

curl -X POST http://localhost:3021/api/query \
  -H "Content-Type: application/json" \
  -d '{"question":"How do I access The Hub?", "userType":"pupil"}'
