require('dotenv').config();
const chrome = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');
const { sql } = require('@vercel/postgres');
const fs = require('fs');
const path = require('path');

// .env에서 인스타그램 로그인 정보 불러오기
const INSTAGRAM_USER = process.env.INSTAGRAM_USER;
const INSTAGRAM_PASS = process.env.INSTAGRAM_PASS;

// 인터파크 티켓, 예스24 티켓, 인스타그램에서 공연일정 스크래핑
const TICKET_SITES = [
  {
    name: 'interpark',
    baseUrl: 'https://ticket.interpark.com/TPGoodsList.asp?Ca=Liv',
    selectors: {
      items: '.product_list',
      title: '.prd_info h4',
      venue: '.prd_info .date_place',
      date: '.prd_info .date',
      image: '.prd_img img',
      link: '.prd_info a'
    }
  },
  {
    name: 'yes24',
    baseUrl: 'https://ticket.yes24.com/NewGenre/GenreNew?Gcode=009006001',
    selectors: {
      items: '.list-wrap .list',
      title: '.info strong',
      venue: '.info .place',
      date: '.info .date',
      image: '.img img',
      link: '.info a'
    }
  }
];

// venues.json에서 모든 공연장 동적으로 로드 (루트에 있는 venues.json 사용)
const venuesPath = path.join(__dirname, '../venues.json');
const venuesData = JSON.parse(fs.readFileSync(venuesPath, 'utf8'));
const allVenues = venuesData; // venues.json은 그냥 배열로 되어있음

// 인스타그램 공연장 계정 목록 (venues.json의 instagram 필드에서 자동 추출)
const INSTAGRAM_VENUES = allVenues
  .filter(venue => venue.websiteUrl && venue.websiteUrl.includes('instagram.com')) // websiteUrl에서 인스타그램 주소만 필터링
  .map(venue => {
    // URL에서 username만 추출
    const username = new URL(venue.websiteUrl).pathname.replace(/\//g, '').trim();
    return {
      username,
      venue_id: venue.id,
      name_ko: venue.name.ko
    };
  });
console.log('✅ [Instagram] 스크래핑 대상 공연장:', INSTAGRAM_VENUES.map(v => v.username));



module.exports = async (req, res) => {
  // CORS 설정
  const allowedOrigins = ['https://jtsgrit0.github.io', 'http://localhost:3000', 'https://barzidorock.vercel.app'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // 관리자 권한 확인 (간단한 토큰 검증)
  const authToken = req.headers.authorization?.replace('Bearer ', '');
  if (authToken !== process.env.ADMIN_API_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let browser = null;
  
  try {
    // Puppeteer로 브라우저 실행
    const executablePath = await chrome.executablePath;
    browser = await puppeteer.launch({
      args: chrome.args,
      executablePath,
      headless: chrome.headless,
    });

    const allSchedules = [];

    // 1. 기존 티켓 사이트에서 스크래핑
    for (const site of TICKET_SITES) {
      const page = await browser.newPage();
      await page.goto(site.baseUrl, { waitUntil: 'networkidle2' });

      const siteSchedules = await page.evaluate((site) => {
        const items = Array.from(document.querySelectorAll(site.selectors.items));
        return items.map(item => {
          const title = item.querySelector(site.selectors.title)?.innerText?.trim() || '';
          const venueText = item.querySelector(site.selectors.venue)?.innerText?.trim() || '';
          const dateText = item.querySelector(site.selectors.date)?.innerText?.trim() || '';
          const imageUrl = item.querySelector(site.selectors.image)?.src || '';
          const link = item.querySelector(site.selectors.link)?.href || '';

          // venues.json의 venue_id 매칭 (공연장 이름으로 찾기)
          let venueId = null;
          if (venueText.includes('CLUBAOR') || venueText.includes('클럽에이오알')) venueId = 'clubaor-hongdae-001';
          if (venueText.includes('우무지') || venueText.includes('Woomuji')) venueId = 'woomuji-hongdae-001';
          if (venueText.includes('리얼라이즈') || venueText.includes('Club Realize')) venueId = 'clubrealize-gwangalli-busan-001';
          if (venueText.includes('HQ 광안리')) venueId = 'hq-gwangalli-busan-001';

          // 날짜를 ISO 형식으로 변환
          const parsedDate = new Date(dateText.includes('~') ? dateText.split('~')[0] : dateText);
          const eventDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

          return {
            id: `${site.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            venue_id: venueId,
            event_name: title,
            description: `스크래핑된 공연: ${venueText}`,
            event_date: eventDate.toISOString(),
            poster_image_url: imageUrl,
            ticket_url: link,
            source: site.name
          };
        }).filter(s => s.venue_id); // venue_id가 매칭된 것만 필터링
      }, site);

      allSchedules.push(...siteSchedules);
      await page.close();
    }

    // 2. 인스타그램 공연장 계정에서 게시물 스크래핑 (수정된 기능)
    const INSTAGRAM_USER = process.env.INSTAGRAM_USER;
    const INSTAGRAM_PASS = process.env.INSTAGRAM_PASS;
    console.log('🔍 [Instagram] 환경변수 확인:', { hasUser: !!INSTAGRAM_USER, hasPass: !!INSTAGRAM_PASS });
    
    if (INSTAGRAM_USER && INSTAGRAM_PASS && INSTAGRAM_VENUES.length > 0) {
      try {
        // 인스타그램 로그인
        const loginPage = await browser.newPage();
        await loginPage.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await loginPage.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2', timeout: 30000 });
        console.log('✅ [Instagram] 로그인 페이지 로드 완료');

        // 로그인 정보 입력
        await loginPage.waitForSelector('input[name="username"]', { timeout: 10000 });
        await loginPage.type('input[name="username"]', INSTAGRAM_USER, { delay: 100 });
        await loginPage.type('input[name="password"]', INSTAGRAM_PASS, { delay: 100 });
        
        // 로그인 버튼 클릭 (최신 셀렉터로 업데이트)
        const loginBtn = await loginPage.waitForSelector('button[type="submit"]', { timeout: 5000 });
        await loginBtn.click();
        await loginPage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(e => console.log('⚠️ [Instagram] 로그인 후 네비게이션 타임아웃, 계속 진행합니다:', e.message));
        
        // 2차 인증(보안 코드) 화면 감지
        const hasChallenge = await loginPage.$('input[name="verificationCode"]').catch(() => null);
        if (hasChallenge) {
          console.log('❌ [Instagram] 2차 인증(보안 코드)이 필요합니다. 웹에서 직접 로그인해서 2차 인증을 완료한 후 다시 시도해주세요.');
          await loginPage.close();
        } else {
          console.log('✅ [Instagram] 로그인 완료 (2차 인증 없음)');
          
          // 각 공연장 인스타그램 프로필에서 최신 게시물 스크래핑
          for (const venue of INSTAGRAM_VENUES) {
            console.log(`🔍 [Instagram] ${venue.name_ko}(${venue.username}) 프로필 스크래핑 시작`);
            const profilePage = await browser.newPage();
            await profilePage.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            try {
              await profilePage.goto(`https://www.instagram.com/${venue.username}/`, { waitUntil: 'networkidle2', timeout: 30000 });
              await profilePage.waitForSelector('div[role="grid"]', { timeout: 15000 }); // 최신 프로필 게시물 그리드 셀렉터
              console.log(`✅ [Instagram] ${venue.username} 프로필 페이지 로드 완료`);

              // 최근 10개 게시물 링크 추출 (최신 셀렉터로 업데이트)
              const postLinks = await profilePage.$$eval('div[role="grid"] a', links => 
                links.map(l => l.href).slice(0, 10)
              );
              console.log(`✅ [Instagram] ${venue.username} 게시물 ${postLinks.length}개 발견`);

              // 각 게시물 상세 페이지에서 캡션과 날짜 추출
              for (const postUrl of postLinks) {
                const postPage = await browser.newPage();
                await postPage.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                
                try {
                  await postPage.goto(postUrl, { waitUntil: 'networkidle2', timeout: 20000 });
                  await postPage.waitForSelector('div[data-testid="post-caption"]', { timeout: 10000 }).catch(() => null);
                  
                  // 게시물 캡션 추출 (최신 셀렉터로 업데이트)
                  const caption = await postPage.$eval('div[data-testid="post-caption"]', el => el?.textContent || '').catch(() => '');
                  const imageUrl = await postPage.$eval('article img', el => el?.src || '').catch(() => '');
                  console.log(`✅ [Instagram] 게시물 캡션 추출 완료 (길이: ${caption.length})`);

                  // 다양한 날짜 형식 매칭 정규식 업데이트
                  const datePatterns = [
                    /(\d{4})\.(\d{1,2})\.(\d{1,2})/, // 2026.10.05
                    /(\d{1,2})\/(\d{1,2})/, // 10/05
                    /(\d{1,2})월\s*(\d{1,2})일/, // 10월 05일
                    /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/ // 2026년 10월 05일
                  ];
                  
                  let eventDate = new Date();
                  for (const pattern of datePatterns) {
                    const match = caption.match(pattern);
                    if (match) {
                      if (match.length === 4) { // 2026.10.05 형식
                        eventDate = new Date(`${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}T19:00:00.000Z`);
                      } else if (match.length === 3) { // 10/05 또는 10월 05일 형식
                        const year = new Date().getFullYear();
                        eventDate = new Date(`${year}-${match[1].padStart(2,'0')}-${match[2].padStart(2,'0')}T19:00:00.000Z`);
                      }
                      console.log(`✅ [Instagram] 날짜 추출 성공: ${eventDate.toISOString()} (원본: ${match[0]})`);
                      break;
                    }
                  }

                  // 이벤트 제목 추출
                  const eventName = caption.split('\n')[0]?.trim() || `${venue.name_ko} 공연`;
                  
                  // 스케줄 배열에 추가
                  allSchedules.push({
                    id: `instagram-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    venue_id: venue.venue_id,
                    event_name: eventName,
                    description: caption,
                    event_date: eventDate.toISOString(),
                    poster_image_url: imageUrl,
                    ticket_url: postUrl,
                    source: 'instagram'
                  });
                  console.log(`✅ [Instagram] 공연일정 추가됨: ${eventName} @${venue.name_ko}`);
                  
                  await postPage.close();
                } catch (postError) {
                  console.log(`⚠️ [Instagram] 게시물 스크래핑 오류: ${postError.message}`);
                  await postPage.close();
                }
              }
              await profilePage.close();
            } catch (profileError) {
              console.log(`⚠️ [Instagram] 프로필 스크래핑 오류 (${venue.username}): ${profileError.message}`);
              await profilePage.close();
            }
          }
          await loginPage.close();
        }
      } catch (instagramError) {
        console.log('❌ [Instagram] 전체 스크래핑 오류:', instagramError.message);
      }
    } else {
      console.log('⚠️ [Instagram] 스크래핑 스킵: 환경변수 또는 공연장 계정 정보 부족');
    }

    // Postgres에 모든 스케줄 저장
    console.log(`✅ [scrape-schedules] 총 ${allSchedules.length}개의 공연일정 스크래핑 완료`);

    try {
      let savedCount = 0;
      for (const schedule of allSchedules) {
        // ON CONFLICT를 사용하여 중복 데이터 방지 (UPSERT)
        await sql`
          INSERT INTO schedules (venue_id, event_name, description, event_date, poster_image_url, ticket_url, source)
          VALUES (${schedule.venue_id}, ${schedule.event_name}, ${schedule.description}, ${schedule.event_date}, ${schedule.poster_image_url}, ${schedule.ticket_url}, ${schedule.source})
          ON CONFLICT (venue_id, event_date) DO UPDATE SET
            event_name = EXCLUDED.event_name,
            description = EXCLUDED.description,
            poster_image_url = EXCLUDED.poster_image_url,
            ticket_url = EXCLUDED.ticket_url;
        `;
        savedCount++;
      }
      console.log(`✅ [Postgres] ${savedCount}개의 공연일정 저장 완료`);
    } catch (dbError) {
      console.error('❌ [Postgres] 데이터베이스 저장 오류:', dbError);
      // res.status(500) 등 에러 처리를 여기서 할 수 있습니다.
    }

    res.status(200).json({
      success: true,
      count: allSchedules.length,
      schedules: allSchedules,
      instagram_count: allSchedules.filter(s => s.source === 'instagram').length
    });
  } catch (error) {
    console.error('❌ [scrape-schedules] 스크래핑 중 오류 발생:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  } finally {
    if (browser) await browser.close();

  }
};