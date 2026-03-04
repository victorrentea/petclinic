#!/bin/bash

# Function to stop background processes when the script is stopped
cleanup() {
  echo "Stopping backend and frontend..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
  exit
}

# Trap SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

echo "Starting Petclinic Backend (Spring Boot)..."
cd petclinic-rest
./mvnw spring-boot:run &
BACKEND_PID=$!
cd ..

echo "Starting Petclinic Frontend (Angular)..."
cd petclinic-angular
npm start &
FRONTEND_PID=$!
cd ..

echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Both services are starting. Press Ctrl+C to stop both."
echo "Frontend: http://localhost:4200/"
echo "Backend:  http://localhost:8080/"

# Wait for background processes
wait $BACKEND_PID $FRONTEND_PID
