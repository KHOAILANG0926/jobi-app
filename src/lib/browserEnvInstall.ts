// 입구 파일(src/main.tsx·src/app/main.tsx)의 맨 첫 import로 불러 다른 모듈이 실행되기 전에 브라우저 어댑터를 끼운다.
import { installBrowserEnv } from './browserEnv'
installBrowserEnv()
