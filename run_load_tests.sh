#!/bin/bash

# =============================================================================
# Load Test Runner Script
# Uruchamia testy obciążeniowe k6 z przerwami między testami
# =============================================================================

# Konfiguracja
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/test_results"
PAUSE_MINUTES=10

# Kolory do logów
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Tworzenie katalogu na wyniki
mkdir -p "$RESULTS_DIR"

# Funkcja logowania z timestampem
log() {
    local color=$1
    local message=$2
    echo -e "${color}[$(date '+%Y-%m-%d %H:%M:%S')] ${message}${NC}"
}

# Funkcja uruchamiająca test
run_test() {
    local test_name=$1
    local run_number=$2
    local test_file="${SCRIPT_DIR}/${test_name}.js"
    local output_file="${RESULTS_DIR}/${test_name}_wynik_${run_number}.txt"
    
    log "$BLUE" "=========================================="
    log "$BLUE" "Uruchamiam: ${test_name} (uruchomienie ${run_number})"
    log "$BLUE" "=========================================="
    
    if [[ ! -f "$test_file" ]]; then
        log "$RED" "BŁĄD: Plik testowy nie istnieje: $test_file"
        return 1
    fi
    
    log "$YELLOW" "Wyniki zostaną zapisane do: $output_file"
    
    # Uruchomienie testu k6 i zapisanie wyniku
    k6 run "$test_file" 2>&1 | tee "$output_file"
    local exit_code=${PIPESTATUS[0]}
    
    if [[ $exit_code -eq 0 ]]; then
        log "$GREEN" "✅ Test ${test_name} (uruchomienie ${run_number}) zakończony pomyślnie"
    else
        log "$RED" "❌ Test ${test_name} (uruchomienie ${run_number}) zakończony z błędem (kod: $exit_code)"
    fi
    
    # Dodanie metadanych do pliku wynikowego
    echo "" >> "$output_file"
    echo "=========================================" >> "$output_file"
    echo "Test: ${test_name}" >> "$output_file"
    echo "Uruchomienie: ${run_number}" >> "$output_file"
    echo "Data zakończenia: $(date '+%Y-%m-%d %H:%M:%S')" >> "$output_file"
    echo "Kod wyjścia: ${exit_code}" >> "$output_file"
    echo "=========================================" >> "$output_file"
    
    return $exit_code
}

# Funkcja przerwy między testami
pause_between_tests() {
    local minutes=$1
    local seconds=$((minutes * 60))
    
    log "$YELLOW" "⏸️  Przerwa ${minutes} minut przed następnym testem..."
    log "$YELLOW" "   Zakończenie przerwy o: $(date -d "+${minutes} minutes" '+%H:%M:%S')"
    
    # Countdown z aktualizacją co minutę
    while [[ $seconds -gt 0 ]]; do
        local mins=$((seconds / 60))
        local secs=$((seconds % 60))
        printf "\r${YELLOW}   Pozostało: %02d:%02d ${NC}" $mins $secs
        sleep 10
        seconds=$((seconds - 10))
    done
    echo ""
    log "$GREEN" "✅ Przerwa zakończona, kontynuuję..."
}

# Funkcja główna
main() {
    local start_time=$(date '+%Y-%m-%d %H:%M:%S')
    local total_tests=5
    local current_test=0
    
    log "$GREEN" "=============================================="
    log "$GREEN" "🚀 Rozpoczynam serię testów obciążeniowych"
    log "$GREEN" "   Data startu: $start_time"
    log "$GREEN" "   Katalog wyników: $RESULTS_DIR"
    log "$GREEN" "=============================================="
    echo ""
    
    # Lista testów do uruchomienia: (nazwa_testu, liczba_uruchomień)
    declare -a tests=(
        "spike_test:2"
        "ramup_test:2"
        "soak_test:1"
    )
    
    for test_config in "${tests[@]}"; do
        local test_name="${test_config%%:*}"
        local run_count="${test_config##*:}"
        
        for ((i=1; i<=run_count; i++)); do
            current_test=$((current_test + 1))
            
            log "$BLUE" "📊 Test ${current_test}/${total_tests}"
            
            run_test "$test_name" "$i"
            
            # Przerwa po każdym teście (oprócz ostatniego)
            if [[ $current_test -lt $total_tests ]]; then
                pause_between_tests $PAUSE_MINUTES
            fi
        done
    done
    
    local end_time=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo ""
    log "$GREEN" "=============================================="
    log "$GREEN" "🎉 Wszystkie testy zakończone!"
    log "$GREEN" "   Data startu: $start_time"
    log "$GREEN" "   Data zakończenia: $end_time"
    log "$GREEN" "   Wyniki zapisane w: $RESULTS_DIR"
    log "$GREEN" "=============================================="
    
    # Podsumowanie plików wynikowych
    echo ""
    log "$BLUE" "📁 Wygenerowane pliki wyników:"
    ls -la "$RESULTS_DIR"/*.txt 2>/dev/null || log "$YELLOW" "Brak plików wynikowych"
}

# Uruchomienie
main "$@"
