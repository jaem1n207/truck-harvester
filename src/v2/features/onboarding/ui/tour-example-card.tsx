import { type ReactNode } from 'react'

import {
  Bell,
  CheckCircle2,
  FolderOpen,
  LoaderCircle,
  type LucideIcon,
} from 'lucide-react'

import { type TourExampleKind } from '../lib/tour-steps'

interface TourExampleCardProps {
  kind: TourExampleKind
}

interface ExampleShellProps {
  label: string
  icon: LucideIcon
  children: ReactNode
}

const ExampleShell = ({ label, icon: Icon, children }: ExampleShellProps) => (
  <div
    aria-label={label}
    className="bg-muted/40 border-border mt-4 rounded-lg border p-3"
    data-tour-example={label}
  >
    <div className="text-muted-foreground mb-2 flex items-center gap-2 text-xs font-medium">
      <Icon aria-hidden="true" className="size-4" />
      <span>{label}</span>
    </div>
    {children}
  </div>
)

const UrlExample = () => (
  <ExampleShell icon={CheckCircle2} label="주소 예시">
    <div className="grid gap-2 text-sm">
      <div>
        <p className="text-foreground font-medium">주소창 전체 복사</p>
        <p className="text-muted-foreground font-mono text-xs break-all">
          https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=...
        </p>
      </div>
      <div className="border-border bg-background rounded-md border px-3 py-2">
        <p className="text-foreground font-medium">덤프 메가트럭 4.5톤</p>
        <p className="text-xs font-medium text-emerald-700">확인 완료</p>
      </div>
      <p className="text-muted-foreground text-xs">
        DetailView.asp?...처럼 앞부분이 빠진 주소는 찾지 못할 수 있어요.
      </p>
    </div>
  </ExampleShell>
)

const FolderExample = () => (
  <ExampleShell icon={FolderOpen} label="저장 예시">
    <div className="grid gap-2 text-sm">
      <div className="border-border bg-background flex items-center gap-2 rounded-md border px-3 py-2">
        <FolderOpen aria-hidden="true" className="text-primary size-4" />
        <div>
          <p className="text-muted-foreground text-xs">저장 폴더 고르기</p>
          <p className="text-foreground font-medium">truck-test</p>
        </div>
      </div>
      <pre className="text-muted-foreground overflow-x-auto rounded-md text-xs leading-relaxed">
        {`truck-test
└─ 서울80바1234
   ├─ 사진 1
   ├─ 사진 2
   └─ 차량정보.txt`}
      </pre>
    </div>
  </ExampleShell>
)

const ProgressExample = () => (
  <ExampleShell icon={LoaderCircle} label="진행 예시">
    <div className="grid gap-2 text-sm">
      <div className="border-border bg-background flex items-center justify-between gap-3 rounded-md border px-3 py-2">
        <span className="text-foreground font-medium">덤프 메가트럭 4.5톤</span>
        <span className="text-muted-foreground text-xs font-medium">
          저장 중
        </span>
      </div>
      <div className="border-border bg-background flex items-center justify-between gap-3 rounded-md border px-3 py-2">
        <span className="text-foreground font-medium">카고 마이티</span>
        <span className="text-xs font-medium text-emerald-700">저장 완료</span>
      </div>
      <p className="text-muted-foreground flex items-center gap-2 text-xs">
        <Bell aria-hidden="true" className="size-4" />
        완료 알림도 원하면 켤 수 있어요.
      </p>
    </div>
  </ExampleShell>
)

export function TourExampleCard({ kind }: TourExampleCardProps) {
  if (kind === 'url-example') {
    return <UrlExample />
  }

  if (kind === 'folder-example') {
    return <FolderExample />
  }

  return <ProgressExample />
}
