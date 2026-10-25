#!/usr/bin/env bash
# =============================================================================
# run_benchmark.sh
# Interlock — Full Distributed Benchmark Pipeline
#
# What this script does (in order):
#   1. Pre-flight checks  — Node, Redis, npm dependencies
#   2. Start Redis        — if not already running
#   3. Install deps       — backend and benchmarking npm packages
#   4. Run benchmark      — Phase A (find B) + Phase B (3-curve comparative)
#   5. Output report      — benchmarking/results/BENCHMARK_REPORT.md
#
# Usage:
#   bash run_benchmark.sh               # Full run (discovers B automatically)
#   bash run_benchmark.sh --skip-phase-a --B=300  # Use known B, skip Phase A
#   bash run_benchmark.sh --quick       # Same as --skip-phase-a --B=100 (dev/CI)
#
# Prerequisites:
#   • Node.js >= 18
#   • Redis   >= 6  (redis-server must be in PATH, or already running)
#   • backend/.env  (needs PORT, JWT_SECRET, MONGODB_URI etc. — DB is bypassed
#                    during benchmark but the file must exist)
# =============================================================================

set -euo pipefail

# ── Colour helpers ──────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
header()  { echo -e "\n${BOLD}${CYAN}══ $* ══${NC}\n"; }

# ── Script directory (works when called from any location) ──────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Parse arguments ─────────────────────────────────────────────────────────
BENCH_ARGS=""
REDIS_STARTED_BY_US=false

for arg in "$@"; do
  case "$arg" in
    --quick)
      BENCH_ARGS="--skip-phase-a --B=100"
      warn "Quick mode: skipping Phase A, using B=100."
      ;;
    --skip-phase-a=*|--B=*)
      BENCH_ARGS="$BENCH_ARGS $arg"
      ;;
    --skip-phase-a|--help)
      BENCH_ARGS="$BENCH_ARGS $arg"
      ;;
  esac
done

# ── Banner ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║     INTERLOCK — Distributed Backend Benchmark Suite      ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# =============================================================================
# STEP 1: Pre-flight checks
# =============================================================================
header "STEP 1 — Pre-flight Checks"

# Node.js
if ! command -v node &>/dev/null; then
  error "Node.js is not installed. Please install Node.js >= 18 from https://nodejs.org"
fi
NODE_VER=$(node --version)
info "Node.js: $NODE_VER"

# Redis CLI
if ! command -v redis-cli &>/dev/null; then
  error "redis-cli not found. Install Redis: https://redis.io/docs/getting-started/"
fi
info "Redis CLI: $(redis-cli --version)"

# backend/.env
if [[ ! -f "backend/.env" ]]; then
  warn "backend/.env not found. Creating a minimal one for benchmark mode…"
  cat > backend/.env <<EOF
PORT=5001
BENCHMARK_MODE=true
ENABLE_REDIS_ADAPTER=true
JWT_SECRET=benchmark_secret_placeholder
MONGODB_URI=mongodb://localhost:27017/interlock_bench
NODE_ENV=development
EOF
  success "backend/.env created (benchmark mode, MongoDB will be bypassed)."
fi

success "All pre-flight checks passed."

# =============================================================================
# STEP 2: Ensure Redis is running
# =============================================================================
header "STEP 2 — Redis"

if redis-cli ping &>/dev/null; then
  success "Redis is already running and responding to PING."
else
  info "Redis not running. Attempting to start redis-server in background…"

  if ! command -v redis-server &>/dev/null; then
    error "redis-server not found in PATH. Start Redis manually and re-run the script."
  fi

  redis-server --daemonize yes --logfile /tmp/interlock-redis.log
  sleep 1

  if redis-cli ping &>/dev/null; then
    success "Redis started successfully."
    REDIS_STARTED_BY_US=true
  else
    error "Failed to start Redis. Check /tmp/interlock-redis.log for details."
  fi
fi

# =============================================================================
# STEP 3: Install npm dependencies
# =============================================================================
header "STEP 3 — Installing Dependencies"

info "Installing backend dependencies…"
npm install --prefix backend --silent
success "Backend deps installed."

info "Installing benchmark dependencies…"
npm install --prefix benchmarking --silent
success "Benchmark deps installed."

# =============================================================================
# STEP 4: Run the benchmark
# =============================================================================
header "STEP 4 — Running Benchmark"
info "This will take several minutes. Please do not close this terminal."
echo ""

# Run the benchmark orchestrator
node benchmarking/run-benchmark.js $BENCH_ARGS

# =============================================================================
# STEP 5: Output summary
# =============================================================================
REPORT_PATH="benchmarking/results/BENCHMARK_REPORT.md"

header "STEP 5 — Done"

if [[ -f "$REPORT_PATH" ]]; then
  success "Benchmark complete! Report generated:"
  echo ""
  echo -e "  ${BOLD}📄 $SCRIPT_DIR/$REPORT_PATH${NC}"
  echo ""
  echo "  Raw JSON data:"
  echo "    Phase A → benchmarking/results/phase-a-raw.json"
  echo "    Phase B → benchmarking/results/phase-b-raw.json"
else
  warn "Benchmark ran but report file not found at $REPORT_PATH."
fi

# ── Cleanup: Stop Redis if we started it ─────────────────────────────────────
if [[ "$REDIS_STARTED_BY_US" == "true" ]]; then
  info "Stopping Redis instance that was started by this script…"
  redis-cli shutdown nosave 2>/dev/null || true
  success "Redis stopped."
fi

echo ""
echo -e "${BOLD}${GREEN}All done. Open the report to see your results!${NC}"
echo ""
