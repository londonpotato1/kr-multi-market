# Wave 1 Baseline

Pre-modularization snapshot for visual + selector regression check.

- `dark.png` / `light.png` — sample full-page screenshots at 1920x1080 (사용자가 수동 첨부)
- `component-classes.txt` — test snapshot of className values in src/components + App.tsx (73 entries)
- `css-selectors.txt` — sample of class selectors in src/App.css (88 entries)

Wave 1 종료 조건: 분리 후 동일 명령으로 재추출 → diff 0.

## 스크린샷 캡처 안내 (사용자)

브라우저 `http://localhost:5173` 접속 → 우상단 ThemeToggle 으로 다크/라이트 양 모드 캡처:
- 다크 → `dark.png` 로 이 디렉토리에 저장
- 라이트 → `light.png` 로 이 디렉토리에 저장
- 캡처 영역: 전체 페이지 (1920×1080 권장)
