#!/bin/sh

curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"question":"What is a hammer used for?"}'
