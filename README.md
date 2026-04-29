# 🚛 트럭 매물 수집기 (Truck Harvester)

중고 트럭 매물 정보와 이미지를 자동으로 수집하고 정리하는 Next.js 16 기반 웹 애플리케이션입니다.
현재 루트 `/` 경로가 재구축된 앱을 제공합니다. 기존 `/v2` 주소는 호환성을 위해 `/`로 리다이렉트되며, 구현 내부 네임스페이스는 `src/v2/*`에 유지됩니다.

🌐 **라이브 사이트**: [https://truck-harvester.vercel.app/](https://truck-harvester.vercel.app/)

## 🎬 제품 소개 영상

- **20초 프로모션 MP4**: [`videos/truck-harvester-promo/renders/truck-harvester-promo.mp4`](videos/truck-harvester-promo/renders/truck-harvester-promo.mp4)
- **HyperFrames 소스**: [`videos/truck-harvester-promo/`](videos/truck-harvester-promo/)

## ✨ 주요 기능

- 📋 **URL 기반 자동 수집**: 중고트럭 매물 URL 입력으로 정보 자동 추출
- 🖼️ **이미지 일괄 다운로드**: 매물 이미지를 체계적으로 정리하여 다운로드
- 🧩 **붙여넣기 주소 정리**: 복사한 대화나 메모에서 지원되는 매물 주소 자동 추출
- 📁 **파일 시스템 통합**: File System Access API로 브라우저에서 직접 파일 저장
- 📦 **ZIP 다운로드 대안**: 구형 브라우저를 위한 ZIP 파일 생성 기능
- 🌙 **다크 모드 지원**: 시스템 설정에 따른 자동 테마 전환
- ♿ **접근성 최적화**: WCAG 2.1 AA 준수, 키보드 네비게이션 지원
- 📱 **반응형 디자인**: 모든 디바이스에서 최적화된 사용자 경험
- ⚙️ **현재 파싱 API**: `POST /api/v2/parse-truck`

## 🛠️ 개발 환경 설정

### 설치

```bash
bun install
```

### 개발 서버 실행

```bash
bun dev
```

[http://localhost:3000](http://localhost:3000)에서 애플리케이션을 확인할 수 있습니다.

## 📋 스크립트 명령어

### 개발 관련

- `bun dev` - 개발 서버 실행 (Turbopack 사용)
- `bun run build` - 프로덕션 빌드
- `bun run start` - 프로덕션 서버 실행

### 코드 품질 관리

- `bun run lint` - ESLint 검사
- `bun run lint:fix` - ESLint 자동 수정
- `bun run format` - Prettier 포맷팅
- `bun run format:check` - Prettier 포맷 확인
- `bun run typecheck` - TypeScript 타입 검사

### 통합 코드 품질 검사

- `bun run code:check` - 타입체크, 린트, 포맷, 테스트 통합 검사
- `bun run code:fix` - 린트 자동 수정 및 포맷팅
- `bun run code:audit` - 코드 품질 + 보안 + 의존성 종합 검사

### 테스트

- `bun run test` - Vitest 테스트 실행
- `bun run test:coverage` - 테스트 커버리지

### 전체 코드 점검

```bash
bun run code:audit
```

이 명령은 타입 체크, 린트, 포맷 검사, 테스트, 보안 감사, 의존성 버전
확인을 순차적으로 실행합니다.

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

### 커밋 작성

Conventional Commits 형식으로 직접 작성합니다:

```bash
git commit -m "fix: 저장 폴더 권한 확인 보정"
```

`commit-msg` 훅이 commitlint로 메시지 형식을 검증합니다.

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
   bun run code:check
   ```

2. **개발 중**
   - 파일 저장 시 에디터의 자동 포맷팅 활용
   - 주기적으로 `bun run lint` 실행

3. **커밋 전**
   - Git hooks가 자동으로 검사 실행
   - 커밋 메시지는 Conventional Commits 형식으로 직접 작성

4. **정기적 점검**

   ```bash
   bun run code:audit
   ```

## 📦 기술 스택

### 프론트엔드

- **Framework**: Next.js 16.2.4 with App Router & Turbopack
- **Runtime UI**: React 19.2
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS 4 with design tokens
- **UI Components**: Radix UI primitives + local shadcn-style UI primitives
- **Animations**: Motion (formerly Framer Motion)
- **Theme**: Static root tokens in `src/app/theme.css` with Tailwind CSS utilities

### 백엔드 & API

- **API Routes**: Next.js 16 Node.js route handlers
- **Web Scraping**: Cheerio for HTML parsing
- **File Operations**: File System Access API + JSZip
- **Image Handling**: Fetched image blobs are saved directly without runtime stamping

### 상태 관리 & 폼

- **State Management**: Vanilla Zustand stores without persistence middleware
- **Form Handling**: Custom URL chip input with Zod-backed parsing and validation
- **Data Validation**: Zod 4 schemas

### 개발 도구 & 품질

- **Package Manager**: Bun
- **Testing**: Vitest + jsdom + React Testing Library
- **Type Checking**: TypeScript with strict configuration
- **Linting**: ESLint with Next.js rules
- **Formatting**: Prettier with Tailwind CSS plugin
- **Git Hooks**: Husky + lint-staged
- **Commit Convention**: Conventional Commits + Commitlint

### 배포 & 모니터링

- **Hosting**: Vercel
- **Build System**: Turbopack for fast builds
- **SEO**: Next.js Metadata API + OpenGraph images
- **PWA**: Web App Manifest
- **Performance**: Bundle optimization, lazy loading
- **Runtime Monitoring**: No runtime external error-monitoring SDK

## 🚀 배포하기

### Vercel 자동 배포

이 프로젝트는 Vercel에서 자동으로 배포됩니다:

- **라이브 URL**: https://truck-harvester.vercel.app/
- **자동 배포**: `main` 브랜치에 push 시 자동 배포
- **미리보기 배포**: Pull Request 생성 시 미리보기 환경 자동 생성

### 수동 빌드 및 배포

```bash
# 프로덕션 빌드 테스트
bun run build

# 프로덕션 서버 실행 (로컬)
bun run start
```

## 📊 프로젝트 구조 (Feature-Sliced Design 기반)

```text
src/
├── app/                      # Next.js App Router + 글로벌 설정
│   ├── api/v2/parse-truck/  # 현재 서버 파싱 API
│   ├── globals.css          # 글로벌 스타일 + 접근성 개선
│   ├── layout.tsx           # 루트 레이아웃 + 메타데이터
│   ├── page.tsx             # 루트 앱 페이지
│   ├── theme.css            # 루트 앱 디자인 토큰
│   ├── v2/page.tsx          # /v2 호환 리다이렉트
│   ├── opengraph-image.tsx  # OG 이미지 생성
│   ├── icon.tsx             # 파비콘 생성
│   ├── apple-icon.tsx       # Apple 아이콘 생성
│   ├── manifest.ts          # PWA 매니페스트
│   ├── robots.ts            # SEO 설정
│   ├── sitemap.ts           # 사이트맵 생성
│   └── truck-harvester-app.tsx # 메인 앱 컴포넌트
└── v2/                       # 내부 구현 네임스페이스
    ├── design-system/       # 토큰과 모션 프리셋
    ├── entities/            # 트럭, URL, 다운로드 도메인 스키마
    ├── features/            # 매물 준비, 파싱, 저장, 온보딩 워크플로우
    ├── shared/              # 공통 유틸리티, 상태, UI 프리미티브
    └── widgets/             # 루트 앱의 복합 UI 블록
```

## 🔒 보안 & 개인정보

- 🛡️ **데이터 보안**: 매물 파싱은 `POST /api/v2/parse-truck`에서 Cheerio로
  서버 측 HTML 요청과 파싱을 수행하고, 저장 파일 생성과 다운로드는
  브라우저에서 처리
- 🚫 **데이터 수집 없음**: 사용자 입력, 파싱 결과, 이미지 파일을 서버에 저장하지 않음
- 🔐 **보안 헤더**: CSP, XSS 보호, 클릭재킹 방지
- 📝 **투명성**: 오픈 소스로 모든 코드 공개
