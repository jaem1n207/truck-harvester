# 🚛 Truck Harvester

트럭 매물 정보를 수집하고 관리하는 Next.js 기반 웹 애플리케이션입니다.

## 🛠️ 개발 환경 설정

### 설치

```bash
npm install
```

### 개발 서버 실행

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📋 스크립트 명령어

### 개발 관련

- `npm run dev` - 개발 서버 실행 (Turbopack 사용)
- `npm run build` - 프로덕션 빌드
- `npm run start` - 프로덕션 서버 실행

### 코드 품질 관리

- `npm run lint` - ESLint 검사
- `npm run lint:fix` - ESLint 자동 수정
- `npm run format` - Prettier 포맷팅
- `npm run format:check` - Prettier 포맷 확인
- `npm run typecheck` - TypeScript 타입 검사

### 통합 코드 품질 검사

- `npm run code:check` - 타입체크, 린트, 포맷, 테스트 통합 검사
- `npm run code:fix` - 린트 자동 수정 및 포맷팅
- `npm run code:audit` - 코드 품질 + 보안 + 의존성 종합 검사

### 테스트

- `npm run test` - Vitest 테스트 실행
- `npm run test:ui` - Vitest UI 모드
- `npm run test:coverage` - 테스트 커버리지

### 전체 코드 점검 스크립트

```bash
./scripts/code-check.sh
```

이 스크립트는 다음 항목들을 순차적으로 검사합니다:

- ✅ TypeScript 타입 체크
- ✅ ESLint 검사 (자동 수정 포함)
- ✅ Prettier 포맷 검사 (자동 포맷팅 포함)
- ✅ 테스트 실행
- ✅ 보안 취약점 검사
- ✅ 의존성 버전 확인
- ✅ 프로덕션 빌드 테스트

## 🔧 Git Hooks

프로젝트에는 다음과 같은 Git Hooks가 설정되어 있습니다:

### Pre-commit Hook

커밋 전에 변경된 파일에 대해 자동으로 실행:

- ESLint 자동 수정
- Prettier 포맷팅
- 스테이징된 파일만 대상

### Commit Message Hook

커밋 메시지 형식 검증:

- Conventional Commits 규칙 준수 확인

## 📝 커밋 메시지 컨벤션

이 프로젝트는 [Conventional Commits](https://www.conventionalcommits.org/) 규칙을 따릅니다.

### 커밋 타입

- `feat`: 새로운 기능 추가
- `fix`: 버그 수정
- `docs`: 문서 수정
- `style`: 코드 포맷팅 (기능 변경 없음)
- `refactor`: 코드 리팩토링
- `perf`: 성능 개선
- `test`: 테스트 추가/수정
- `chore`: 빌드 업무, 패키지 관리 등
- `ci`: CI 설정 변경
- `build`: 빌드 시스템 변경
- `revert`: 이전 커밋 되돌리기

### 커밋 메시지 형식

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### 예시

```bash
feat: 트럭 매물 검색 필터 기능 추가
fix: URL 검증 로직 버그 수정
docs: README 설치 가이드 업데이트
refactor: 컴포넌트 구조 개선
```

### Commitizen 사용 (권장)

대화형 커밋 메시지 작성을 위해 Commitizen을 사용할 수 있습니다:

```bash
# 일반 커밋 대신
npx cz
# 또는
npx git-cz
```

## 🔍 코드 품질 도구

### ESLint

- Next.js TypeScript 규칙 적용
- 코드 품질 및 보안 규칙 강화
- 자동 수정 지원

### Prettier

- 일관된 코드 스타일 유지
- TypeScript, JavaScript, JSON, CSS, Markdown 지원

### Husky + lint-staged

- Git hooks를 통한 자동 코드 품질 검사
- 변경된 파일에 대해서만 실행하여 성능 최적화

### Commitlint

- 커밋 메시지 형식 자동 검증
- Conventional Commits 규칙 적용

## 🚀 추천 개발 워크플로우

1. **개발 시작 전**

   ```bash
   npm run code:check
   ```

2. **개발 중**
   - 파일 저장 시 에디터의 자동 포맷팅 활용
   - 주기적으로 `npm run lint` 실행

3. **커밋 전**
   - Git hooks가 자동으로 검사 실행
   - 커밋 메시지는 `npx cz` 사용 권장

4. **정기적 점검**
   ```bash
   ./scripts/code-check.sh
   ```

## 📦 기술 스택

- **Framework**: Next.js 15 with Turbopack
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI
- **State Management**: Zustand
- **Form Handling**: TanStack Form
- **Testing**: Vitest
- **Code Quality**: ESLint, Prettier, Husky
- **Package Manager**: npm

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
