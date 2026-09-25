import instaloader
import json
import os
import time
from datetime import datetime
from dotenv import load_dotenv

# .env 파일에서 환경변수 불러오기
load_dotenv()

# venues.json 파일에서 공연장 목록 불러오기
with open('venues.json', 'r', encoding='utf-8') as f:
    venues = json.load(f)

# 인스타그램 URL이 있는 공연장만 필터링 (websiteUrl에 인스타그램 URL이 저장되어 있음)
instagram_venues = []
for v in venues:
    website_url = v.get('websiteUrl', '')
    if website_url and 'instagram.com' in website_url:
        # 공연장 정보에 instagram_username 추가
        username = website_url.split('/')[-1].split('?')[0]  # URL 쿼리파라미터 제거
        v['instagram_username'] = username
        instagram_venues.append(v)

print(f"인스타그램 계정이 있는 공연장: {len(instagram_venues)}개")

# Instaloader 인스턴스 생성
L = instaloader.Instaloader(
    download_pictures=True,
    download_videos=False,
    download_video_thumbnails=False,
    download_geotags=False,
    download_comments=False,
    save_metadata=True,
    compress_json=False
)

# .env에서 인스타그램 로그인 정보 불러와서 로그인
instagram_user = os.getenv('INSTAGRAM_USER')
instagram_pass = os.getenv('INSTAGRAM_PASS')

print("⚠️ 비로그인 모드로 실행합니다. (공개 프로필만 접근 가능)")

# 결과를 저장할 디렉토리 생성
output_dir = 'scraped_schedules'
os.makedirs(output_dir, exist_ok=True)

# 각 공연장의 인스타그램 스크래핑
for venue in instagram_venues:
    venue_name_ko = venue['name']['ko']  # 한글 공연장 이름 사용
    instagram_username = venue['instagram_username']
    print(f"\n=== {venue_name_ko} ({instagram_username}) 스크래핑 시작 ===")
    
    venue_output_dir = os.path.join(output_dir, venue_name_ko)
    os.makedirs(venue_output_dir, exist_ok=True)
    
    try:
        # 프로필 가져오기
        profile = instaloader.Profile.from_username(L.context, instagram_username)
        
        # 최근 50개의 게시물 가져오기 (공연일정 관련 게시물 필터링)
        posts = profile.get_posts()
        event_count = 0
        
        for post in posts:
            if event_count >= 20:  # 각 공연장당 최근 20개 게시물만 처리
                break
                
            # 게시물 캡션에서 '공연일정' 키워드가 있는지 확인
            caption = post.caption if post.caption else ""
            if '공연일정' in caption or '일정' in caption or '공연' in caption:
                print(f"게시물 발견: {post.date_local.strftime('%Y-%m-%d')}")
                
                # 이미지 다운로드
                L.download_post(post, target=venue_output_dir)
                
                # 메타데이터 저장
                metadata = {
                    'venue_name': venue_name_ko,
                    'instagram_username': instagram_username,
                    'post_url': f"https://www.instagram.com/p/{post.shortcode}/",
                    'date': post.date_local.isoformat(),
                    'caption': caption,
                    'image_url': post.url,
                    'likes': post.likes,
                    'comments': post.comments
                }
                
                # JSON 파일로 저장
                metadata_file = os.path.join(venue_output_dir, f"{post.shortcode}_metadata.json")
                with open(metadata_file, 'w', encoding='utf-8') as mf:
                    json.dump(metadata, mf, ensure_ascii=False, indent=2)
                
                event_count += 1
                time.sleep(2)  # 인스타그램 차단 방지
        
        print(f"{venue_name}: {event_count}개의 공연일정 게시물 추출 완료")
        
    except Exception as e:
        print(f"{venue_name_ko} 스크래핑 중 오류 발생: {str(e)}")
        continue

print("\n=== 모든 공연장 스크래핑 완료 ===")