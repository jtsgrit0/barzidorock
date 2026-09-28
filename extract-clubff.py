import instaloader
import json
import os

# instaloader 초기화
L = instaloader.Instaloader()

# 클럽ff 인스타그램 로그인 및 게시물 가져오기
try:
    # 로그인 (이메일/비밀번호 사용)
    L.login('junctionsetgrum', 'Ggdrecon3534@!.')
    print('✅ 로그인 성공!')
    
    # 클럽ff 프로필 가져오기 (hongdaeff)
    profile = instaloader.Profile.from_username(L.context, 'hongdaeff')
    print('✅ 클럽ff 프로필 가져오기 성공!')
    
    # 최근 5개 게시물만 가져오기
    posts = []
    for i, post in enumerate(profile.get_posts()):
        if i >= 5:
            break
        posts.append({
            'venue_id': 'clubff',
            'event_name': '클럽ff 공연',
            'description': post.caption or '공연 정보 없음',
            'poster_image': post.url,
            'event_date': post.date_utc.isoformat()
        })
        print(f'✅ 게시물 {i+1} 추출 완료: {post.url}')
    
    # 결과를 JSON 파일로 저장
    with open('clubff-schedules.json', 'w', encoding='utf-8') as f:
        json.dump(posts, f, ensure_ascii=False, indent=2)
    
    print('🎉 클럽ff 최신 공연일정 추출 완료! clubff-schedules.json에 저장됨')
    print(json.dumps(posts, ensure_ascii=False, indent=2))
    
except Exception as e:
    print(f'❌ 오류 발생: {str(e)}')
    import traceback
    traceback.print_exc()