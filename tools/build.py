# index.html(아티팩트용 조각)을 Vercel용 완전한 HTML 문서로 만들어 public/ 에 저장해요.
import os, shutil
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
s = open(os.path.join(root, 'index.html'), encoding='utf-8').read()
# 신청 접수 주소(구글 Apps Script 웹앱)는 config/endpoint.txt 에서 읽어 배포본에만 넣어요.
ep = open(os.path.join(root, 'config', 'endpoint.txt'), encoding='utf-8').read().strip()
assert 'endpoint: ""' in s
s = s.replace('endpoint: ""', 'endpoint: "' + ep + '"', 1)
i = s.index('<div id="landing">')
head_extra, body = s[:i], s[i:]
icon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cg fill='none' stroke='%236fd23a' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M22 37C23 33 28 33 31 37C30 30 31 24 35 23C39 23 41 30 42 37C42 28 43 21 47 20C52 20 53 28 53 36C54 29 57 24 61 25C65 27 64 33 63 38C67 33 73 32 75 35C77 42 72 52 62 59C57 62 52 63 48 63C41 63 33 59 27 53C22 48 20 42 22 37Z'/%3E%3Cpath d='M40 51Q48 58 57 51'/%3E%3Cpath d='M37 62L31 74M62 62L70 73'/%3E%3C/g%3E%3C/svg%3E"
doc = ('<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n'
 '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
 '<meta name="description" content="콘텐츠로 나를 기록하고, 나만의 브랜드를 쌓아가는 크리에이터 커뮤니티. Layered Club 4기 신규 멤버 모집.">\n'
 '<meta property="og:title" content="Layered Club 4기">\n'
 '<meta property="og:description" content="MOVE AT YOUR OWN PACE. JUST KEEP GOING!">\n'
 '<meta property="og:image" content="img/p1.jpg">\n'
 f'<link rel="icon" href="{icon}">\n'
 '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);color-scheme:light}'
 'body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>\n'
 + '<link rel="stylesheet" href="fonts/pretendard/pretendardvariable-dynamic-subset.css">\n' + head_extra + '</head>\n<body>\n' + body + '\n</body>\n</html>\n')
out = os.path.join(root, 'public')
shutil.rmtree(out, ignore_errors=True)
os.makedirs(out)
open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(doc)
shutil.copytree(os.path.join(root, 'img'), os.path.join(out, 'img'))
shutil.copytree(os.path.join(root, 'fonts'), os.path.join(out, 'fonts'))
print('built', out, os.path.getsize(os.path.join(out, 'index.html')))
