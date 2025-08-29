#!/bin/bash

# 전체 코드 점검 및 정비 스크립트
# Code Health Check and Maintenance Script

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로고 출력
echo -e "${BLUE}"
echo "==============================================="
echo "  🚛 Truck Harvester - Code Health Check"
echo "==============================================="
echo -e "${NC}"

# 시작 시간 기록
START_TIME=$(date +%s)

# 진행 상황 출력 함수
log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 의존성 확인
log_step "의존성 확인 중..."
if ! command -v node &> /dev/null; then
    log_error "Node.js가 설치되지 않았습니다."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    log_error "npm이 설치되지 않았습니다."
    exit 1
fi

log_success "Node.js $(node --version) 및 npm $(npm --version) 확인 완료"

# 1. TypeScript 타입 체크
log_step "TypeScript 타입 체크 실행 중..."
if npm run typecheck; then
    log_success "타입 체크 통과"
else
    log_error "타입 체크 실패"
    exit 1
fi

# 2. ESLint 검사
log_step "ESLint 검사 실행 중..."
if npm run lint; then
    log_success "ESLint 검사 통과"
else
    log_warning "ESLint 문제 발견됨. 자동 수정을 시도합니다..."
    if npm run lint:fix; then
        log_success "ESLint 문제 자동 수정 완료"
    else
        log_error "ESLint 자동 수정 실패"
        exit 1
    fi
fi

# 3. Prettier 포맷 체크
log_step "Prettier 포맷 체크 실행 중..."
if npm run format:check; then
    log_success "코드 포맷 확인 완료"
else
    log_warning "포맷 문제 발견됨. 자동 포맷팅을 실행합니다..."
    if npm run format; then
        log_success "코드 포맷팅 완료"
    else
        log_error "코드 포맷팅 실패"
        exit 1
    fi
fi

# 4. 테스트 실행
log_step "테스트 실행 중..."
if npm run test; then
    log_success "모든 테스트 통과"
else
    log_error "테스트 실패"
    exit 1
fi

# 5. 보안 취약점 검사
log_step "보안 취약점 검사 중..."
if npm audit --audit-level=high; then
    log_success "심각한 보안 취약점 없음"
else
    log_warning "보안 취약점 발견됨. 'npm audit fix' 실행을 고려하세요."
fi

# 6. 의존성 버전 확인
log_step "의존성 버전 확인 중..."
echo "오래된 패키지:"
npm outdated || log_success "모든 패키지가 최신 상태입니다."

# 7. 빌드 테스트
log_step "프로덕션 빌드 테스트 중..."
if npm run build; then
    log_success "빌드 성공"
else
    log_error "빌드 실패"
    exit 1
fi

# 실행 시간 계산
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo -e "\n${GREEN}==============================================="
echo "  ✅ 코드 점검 완료!"
echo "  ⏱️  실행 시간: ${DURATION}초"
echo "===============================================${NC}"

# 개선 제안
echo -e "\n${YELLOW}📋 개선 제안:${NC}"
echo "- 정기적으로 이 스크립트를 실행하여 코드 품질을 유지하세요"
echo "- Git hooks를 사용하여 커밋 전 자동 검사를 설정하세요"
echo "- 테스트 커버리지를 확인하려면 'npm run test:coverage'를 실행하세요"
echo "- 의존성 업데이트 시 'npm audit fix'를 실행하세요"