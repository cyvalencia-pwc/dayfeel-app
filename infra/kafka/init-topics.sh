#!/usr/bin/env bash
set -euo pipefail
for topic in identity-events content-events analysis-jobs analysis-results dayfeel-analysis dayfeel-events; do
  /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka:29092 --create --if-not-exists --topic "$topic" --partitions 3 --replication-factor 1
  /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka:29092 --create --if-not-exists --topic "$topic.DLT" --partitions 3 --replication-factor 1
done
