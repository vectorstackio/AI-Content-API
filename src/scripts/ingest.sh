#!/bin/sh

curl -X POST http://localhost:3021/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"url":"https://the-brilliant-club.helpscoutdocs.com/article/85-what-is-the-hub", "userType":"pupil"}'
