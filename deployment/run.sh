#!/bin/bash

SETTINGS_TIMESTAMP=$(date +%s) docker compose up -d
#SETTINGS_TIMESTAMP=$(date +%s) docker stack deploy --compose-file ./docker-compose.yml --orchestrator swarm localtest